#!/usr/bin/env python3
"""
Test script for FoodSense AI API
"""
import requests
import json
import sys

API_URL = "https://api-2rzo5otiva-uc.a.run.app/analyze-image"
IMAGE_PATH = "food_label.jpg"

def test_api():
    print(f"🧪 Testing FoodSense AI API")
    print(f"API URL: {API_URL}")
    print(f"Image: {IMAGE_PATH}\n")
    
    try:
        # Open and send the image
        with open(IMAGE_PATH, 'rb') as img_file:
            files = {'image': img_file}
            
            print("📤 Sending request...")
            response = requests.post(API_URL, files=files, timeout=30)
            
            print(f"📊 Status Code: {response.status_code}")
            print(f"⏱️  Response Time: {response.elapsed.total_seconds():.2f}s\n")
            
            # Parse response
            try:
                result = response.json()
                print("📋 Response:")
                print(json.dumps(result, indent=2))
                
                if response.status_code == 200 and result.get('analysis'):
                    print("\n✅ SUCCESS!")
                    print("\n🔍 Analysis Result:")
                    print("─" * 60)
                    print(result.get('analysis', 'No analysis returned'))
                    print("─" * 60)
                    return True
                else:
                    print(f"\n❌ FAILED!")
                    print(f"Error: {result.get('error', 'Unknown error')}")
                    if 'details' in result:
                        print(f"Details: {result['details']}")
                    return False
                    
            except json.JSONDecodeError:
                print(f"❌ Invalid JSON response: {response.text}")
                return False
                
    except FileNotFoundError:
        print(f"❌ ERROR: Image file not found: {IMAGE_PATH}")
        return False
    except requests.exceptions.RequestException as e:
        print(f"❌ ERROR: {str(e)}")
        return False
    except Exception as e:
        print(f"❌ UNEXPECTED ERROR: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = test_api()
    sys.exit(0 if success else 1)
