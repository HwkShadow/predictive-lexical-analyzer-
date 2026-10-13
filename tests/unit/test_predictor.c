#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include "../../src/predictor.h"

static int g_tests_run = 0;
static int g_tests_passed = 0;
static int g_tests_failed = 0;

#define ASSERT_TEST(cond, msg) do { \
    g_tests_run++; \
    if (cond) { \
        g_tests_passed++; \
    } else { \
        g_tests_failed++; \
        printf("  [FAIL] %s:%d: %s\n", __FILE__, __LINE__, msg); \
    } \
} while(0)

static void test_ewma_calculation(void) {
    predictor_t p;
    predictor_config_t cfg;
    cfg.rule = PRED_RULE_EWMA_ONLY;
    cfg.ewma_alpha = 0.50; /* 50% weight for easy math */
    cfg.weighted_p75_weight = 0.5;
    cfg.safe_min_capacity = 16;
    cfg.max_capacity = 1024;
    cfg.min_samples_for_p75 = 5;
    cfg.baseline_init_capacity = 16;
    predictor_init(&p, &cfg);
    
    /* First sample: length 10 -> EWMA = 10.0 */
    predictor_update(&p, TOKEN_CLASS_IDENTIFIER, 10);
    ASSERT_TEST(fabs(p.class_stats[TOKEN_CLASS_IDENTIFIER].ewma_length - 10.0) < 1e-4, 
                "First EWMA sample equals exact sample value");
    
    /* Second sample: length 20 -> EWMA = 0.5*20 + 0.5*10 = 15.0 */
    predictor_update(&p, TOKEN_CLASS_IDENTIFIER, 20);
    ASSERT_TEST(fabs(p.class_stats[TOKEN_CLASS_IDENTIFIER].ewma_length - 15.0) < 1e-4, 
                "Second EWMA sample correctly smoothed");
    
    /* Third sample: length 30 -> EWMA = 0.5*30 + 0.5*15 = 22.5 */
    predictor_update(&p, TOKEN_CLASS_IDENTIFIER, 30);
    ASSERT_TEST(fabs(p.class_stats[TOKEN_CLASS_IDENTIFIER].ewma_length - 22.5) < 1e-4, 
                "Third EWMA sample correctly smoothed");
}

static void test_p75_percentile(void) {
    predictor_t p;
    predictor_init_default(&p);
    
    /* Feed 10 observations for string literals: lengths 10, 10, 10, 10, 20, 20, 20, 30, 40, 50 */
    size_t lengths[10] = {10, 10, 10, 10, 20, 20, 20, 30, 40, 50};
    for (int i = 0; i < 10; ++i) {
        predictor_update(&p, TOKEN_CLASS_STRING, lengths[i]);
    }
    
    /* 75% of 10 is 8 (ceil(7.5)). The 8th element in sorted order is 30. */
    size_t p75 = predictor_get_p75(&p, TOKEN_CLASS_STRING);
    ASSERT_TEST(p75 == 30, "P75 for {10x4, 20x3, 30, 40, 50} must be 30");
}

static void test_markov_transitions(void) {
    predictor_t p;
    predictor_init_default(&p);
    
    /* Simulate sequence: Identifier -> Operator -> Number -> Punctuation -> Identifier */
    predictor_update(&p, TOKEN_CLASS_IDENTIFIER, 5);
    predictor_update(&p, TOKEN_CLASS_OPERATOR, 1);
    predictor_update(&p, TOKEN_CLASS_NUMBER, 3);
    predictor_update(&p, TOKEN_CLASS_PUNCTUATION, 1);
    predictor_update(&p, TOKEN_CLASS_IDENTIFIER, 6);
    predictor_update(&p, TOKEN_CLASS_OPERATOR, 2);
    
    /* Transitions from IDENTIFIER: total 2, both to OPERATOR */
    double prob_op = predictor_get_markov_prob(&p, TOKEN_CLASS_IDENTIFIER, TOKEN_CLASS_OPERATOR);
    ASSERT_TEST(fabs(prob_op - 1.0) < 1e-4, "P(Operator | Identifier) should be 1.0");
    
    double prob_num = predictor_get_markov_prob(&p, TOKEN_CLASS_IDENTIFIER, TOKEN_CLASS_NUMBER);
    ASSERT_TEST(fabs(prob_num - 0.0) < 1e-4, "P(Number | Identifier) should be 0.0");
}

static void test_invalid_candidate_class(void) {
    predictor_t p;
    predictor_init_default(&p);
    size_t low = predictor_predict_capacity(&p, (token_class_t)-1, 0);
    size_t high = predictor_predict_capacity(&p, (token_class_t)TOKEN_CLASS_COUNT, 0);
    ASSERT_TEST(low == 16, "Negative candidate class returns safe minimum");
    ASSERT_TEST(high == 16, "Out-of-range candidate class returns safe minimum");
}

static void test_scanned_capacity_overflow_guard(void) {
    predictor_t p;
    predictor_init_default(&p);
    size_t pred = predictor_predict_capacity(&p, TOKEN_CLASS_IDENTIFIER, SIZE_MAX);
    ASSERT_TEST(pred == SIZE_MAX, "SIZE_MAX scanned prefix does not overflow capacity calculation");
}

static void test_capacity_prediction_clamping(void) {
    predictor_t p;
    predictor_config_t cfg;
    cfg.rule = PRED_RULE_MAX_P75_EWMA;
    cfg.ewma_alpha = 0.20;
    cfg.weighted_p75_weight = 0.70;
    cfg.safe_min_capacity = 32;
    cfg.max_capacity = 512;
    cfg.min_samples_for_p75 = 5;
    cfg.baseline_init_capacity = 16;
    predictor_init(&p, &cfg);
    
    /* With 0 samples, prediction should clamp to safe_min_capacity (32) */
    size_t pred = predictor_predict_capacity(&p, TOKEN_CLASS_IDENTIFIER, 0);
    ASSERT_TEST(pred == 32, "Empty stats clamped to safe_min_capacity (32)");
    
    /* If 50 bytes already scanned, capacity must be at least 51 */
    pred = predictor_predict_capacity(&p, TOKEN_CLASS_IDENTIFIER, 50);
    ASSERT_TEST(pred >= 51, "Prediction must accommodate already scanned bytes");
    
    /* Update with very large sample (10,000) -> must clamp to max_capacity (512) */
    for (int i = 0; i < 10; ++i) {
        predictor_update(&p, TOKEN_CLASS_STRING, 10000);
    }
    pred = predictor_predict_capacity(&p, TOKEN_CLASS_STRING, 0);
    ASSERT_TEST(pred == 512, "Extreme length prediction clamped to max_capacity (512)");
}

#ifdef STANDALONE_TEST
int main(void) {
#else
int run_test_predictor(void) {
#endif
    printf("[TEST] Running Unit Tests: Predictor & Markov Modeling...\n");
    test_ewma_calculation();
    test_p75_percentile();
    test_markov_transitions();
    test_invalid_candidate_class();
    test_scanned_capacity_overflow_guard();
    test_capacity_prediction_clamping();
    
    printf("  Results: %d/%d tests passed (%d failures)\n\n", 
           g_tests_passed, g_tests_run, g_tests_failed);
    return (g_tests_failed == 0) ? 0 : 1;
}
