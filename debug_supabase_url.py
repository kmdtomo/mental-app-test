#!/usr/bin/env python3
import urllib.request
import urllib.error
import sys

# Test downloading from Supabase URL
test_url = sys.argv[1] if len(sys.argv) > 1 else "https://example.supabase.co/storage/v1/object/public/voice-recordings/test.webm"

print(f"Testing URL: {test_url}")
print("=" * 50)

try:
    # Create a request with headers
    req = urllib.request.Request(
        test_url,
        headers={
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
        }
    )
    
    # Try to open the URL
    response = urllib.request.urlopen(req)
    
    print(f"Success! Status code: {response.getcode()}")
    print(f"Content-Type: {response.headers.get('Content-Type')}")
    print(f"Content-Length: {response.headers.get('Content-Length')}")
    
    # Read a small portion to verify
    data = response.read(1024)
    print(f"First 1KB downloaded successfully, total bytes: {len(data)}")
    
except urllib.error.HTTPError as e:
    print(f"HTTP Error {e.code}: {e.reason}")
    print(f"Headers: {e.headers}")
    try:
        error_body = e.read().decode('utf-8')
        print(f"Error body: {error_body}")
    except:
        pass
except urllib.error.URLError as e:
    print(f"URL Error: {e.reason}")
except Exception as e:
    print(f"Unexpected error: {type(e).__name__}: {e}")