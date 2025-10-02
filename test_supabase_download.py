#!/usr/bin/env python3
import urllib.request
import urllib.error
import tempfile
import os
import sys

def test_download_with_different_methods(url):
    """Test different methods to download from Supabase"""
    print(f"Testing URL: {url}")
    print("=" * 80)
    
    # Method 1: Basic urllib
    print("\n1. Testing basic urllib.request.urlretrieve:")
    try:
        temp_file = tempfile.mktemp(suffix='.webm')
        urllib.request.urlretrieve(url, temp_file)
        file_size = os.path.getsize(temp_file)
        print(f"   ✓ Success! Downloaded {file_size} bytes")
        os.remove(temp_file)
    except Exception as e:
        print(f"   ✗ Failed: {type(e).__name__}: {e}")
    
    # Method 2: urllib with User-Agent
    print("\n2. Testing urllib with User-Agent header:")
    try:
        req = urllib.request.Request(url, headers={
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
        })
        response = urllib.request.urlopen(req)
        data = response.read()
        print(f"   ✓ Success! Downloaded {len(data)} bytes")
        print(f"   Content-Type: {response.headers.get('Content-Type')}")
    except urllib.error.HTTPError as e:
        print(f"   ✗ HTTP Error {e.code}: {e.reason}")
        if e.code == 400:
            try:
                error_body = e.read().decode('utf-8')
                print(f"   Error details: {error_body}")
            except:
                pass
    except Exception as e:
        print(f"   ✗ Failed: {type(e).__name__}: {e}")
    
    # Method 3: Using requests library (if available)
    print("\n3. Testing with requests library:")
    try:
        import requests
        response = requests.get(url)
        if response.status_code == 200:
            print(f"   ✓ Success! Downloaded {len(response.content)} bytes")
            print(f"   Content-Type: {response.headers.get('Content-Type')}")
        else:
            print(f"   ✗ HTTP {response.status_code}: {response.reason}")
            print(f"   Response: {response.text[:200]}...")
    except ImportError:
        print("   ⚠ requests library not installed")
    except Exception as e:
        print(f"   ✗ Failed: {type(e).__name__}: {e}")
    
    # Method 4: Check if URL is accessible via HEAD request
    print("\n4. Testing URL accessibility with HEAD request:")
    try:
        req = urllib.request.Request(url, headers={
            'User-Agent': 'Mozilla/5.0'
        })
        req.get_method = lambda: 'HEAD'
        response = urllib.request.urlopen(req)
        print(f"   ✓ URL is accessible")
        print(f"   Content-Type: {response.headers.get('Content-Type')}")
        print(f"   Content-Length: {response.headers.get('Content-Length')}")
    except Exception as e:
        print(f"   ✗ Failed: {type(e).__name__}: {e}")

# Example Supabase URLs to test
example_urls = [
    # Format: https://{project-id}.supabase.co/storage/v1/object/public/{bucket}/{path}
    "https://example.supabase.co/storage/v1/object/public/voice-recordings/test.webm",
]

if __name__ == "__main__":
    if len(sys.argv) > 1:
        # Use provided URL
        test_download_with_different_methods(sys.argv[1])
    else:
        print("Usage: python test_supabase_download.py <supabase_url>")
        print("\nExample URL format:")
        print("https://{project-id}.supabase.co/storage/v1/object/public/{bucket}/{path}")