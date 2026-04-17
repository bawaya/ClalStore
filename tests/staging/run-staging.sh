#!/bin/bash
set -e
echo "Running staging tests..."
echo "Using REAL Supabase — test data will be created and cleaned up"
npx vitest run --config vitest.staging.config.ts --reporter=verbose
echo "Staging tests complete"
