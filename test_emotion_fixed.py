#!/usr/bin/env python3
"""
Test script to verify emotion analysis works with float conversion fix
"""
import sys
import os
import json
import traceback

# Add the vad_deeplearning path
sys.path.append('/Users/komodatomo/Desktop/onsei-laboratory/vad_deeplearning')

try:
    # Test audio file path (update this to your test file)
    test_audio_path = sys.argv[1] if len(sys.argv) > 1 else "test_audio.wav"
    
    print(f"Testing emotion analysis on: {test_audio_path}")
    
    # Import and run inference
    from inference import inference_core
    
    # Run emotion analysis
    result = inference_core(test_audio_path)
    
    if result:
        print("\nEmotion Analysis Result:")
        print(f"File: {result['file']}")
        print(f"Anger (ang): {result['ang']:.4f}")
        print(f"Happiness (hap): {result['hap']:.4f}")
        print(f"Sadness (sad): {result['sad']:.4f}")
        print(f"Predicted emotion: {result['emo']}")
        
        # Test JSON serialization
        print("\nTesting JSON serialization...")
        json_str = json.dumps(result)
        print("JSON output:", json_str)
        
        # Verify types
        print("\nData types:")
        for key, value in result.items():
            print(f"{key}: {type(value).__name__} = {value}")
    else:
        print("Error: No result returned from analysis")
        
except Exception as e:
    print(f"Error occurred: {type(e).__name__}: {e}")
    print("\nTraceback:")
    traceback.print_exc()