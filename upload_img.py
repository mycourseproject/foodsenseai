import requests
import sys
import os

def upload_image(image_path, api_url):
    """
    Upload an image file to the specified API endpoint
    
    Args:
        image_path (str): Path to the image file on your local system
        api_url (str): URL of the API endpoint
        
    Returns:
        dict: The JSON response from the API
    """
    # Check if file exists
    if not os.path.exists(image_path):
        return {"error": f"File not found: {image_path}"}
    
    # Open the file in binary mode
    with open(image_path, 'rb') as image_file:
        # Get the filename for the multipart form
        filename = os.path.basename(image_path)
        
        # Determine content type based on file extension
        content_type = 'image/jpeg'  # default
        if filename.lower().endswith('.png'):
            content_type = 'image/png'
        elif filename.lower().endswith('.webp'):
            content_type = 'image/webp'
        
        # Create the files parameter with the correct field name 'image'
        files = {'image': (filename, image_file, content_type)}
        
        # Make the POST request
        print(f"Uploading {filename} to {api_url}...")
        try:
            response = requests.post(api_url, files=files)
            
            # Print status code for debugging
            print(f"Status code: {response.status_code}")
            
            # Return the response as JSON if possible
            try:
                return response.json()
            except:
                return {"error": "Could not parse JSON response", "text": response.text}
        except requests.exceptions.RequestException as e:
            return {"error": f"Request failed: {str(e)}"}

if __name__ == "__main__":
    # Check if image path is provided as command line argument
    if len(sys.argv) < 2:
        print("Usage: python upload_image.py <image_path> [api_url]")
        sys.exit(1)
    
    # Get image path from command line
    image_file_path = sys.argv[1]
    
    # Get API URL from command line or use default
    api_endpoint = sys.argv[2] if len(sys.argv) > 2 else "https://us-central1-foodsenseai.cloudfunctions.net/api/analyze-image"
    
    # Upload the image
    result = upload_image(image_file_path, api_endpoint)
    print("Result:", result)
