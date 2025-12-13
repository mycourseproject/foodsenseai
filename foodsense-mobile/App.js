import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, TouchableOpacity, Image, ActivityIndicator, ScrollView, Alert, Platform } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { BlurView } from 'expo-blur';
import { useState } from 'react';

const API_URL = "https://api-2rzo5otiva-uc.a.run.app/analyze-image";

export default function App() {
  const [image, setImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState(null);

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 1,
      });

      if (!result.canceled) {
        const imageUri = result.assets[0].uri;
        setImage(imageUri);
        setAnalysis(null);
        await analyzeImage(imageUri);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const takePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission denied', 'Camera permission is required');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [4, 3],
        quality: 1,
      });

      if (!result.canceled) {
        const imageUri = result.assets[0].uri;
        setImage(imageUri);
        setAnalysis(null);
        await analyzeImage(imageUri);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to take photo');
    }
  };

  const analyzeImage = async (imageUri) => {
    const uriToAnalyze = imageUri || image;
    if (!uriToAnalyze) return;

    setLoading(true);
    setAnalysis(null);

    try {
      console.log('Starting image analysis for:', uriToAnalyze);

      const formData = new FormData();

      // Extract filename and determine MIME type
      const uriParts = uriToAnalyze.split('/');
      const filename = uriParts[uriParts.length - 1];

      // Determine MIME type based on file extension
      let mimeType = 'image/jpeg'; // default
      if (filename.toLowerCase().endsWith('.png')) {
        mimeType = 'image/png';
      } else if (filename.toLowerCase().endsWith('.jpg') || filename.toLowerCase().endsWith('.jpeg')) {
        mimeType = 'image/jpeg';
      } else if (filename.toLowerCase().endsWith('.webp')) {
        mimeType = 'image/webp';
      }

      console.log('File info:', { filename, mimeType });

      // Append the image to FormData with proper structure for React Native
      formData.append('image', {
        uri: Platform.OS === 'android' ? uriToAnalyze : uriToAnalyze.replace('file://', ''),
        type: mimeType,
        name: filename || 'photo.jpg',
      });

      console.log('Sending request to:', API_URL);

      const response = await fetch(API_URL, {
        method: 'POST',
        body: formData,
        headers: {
          'Accept': 'application/json',
        },
      });

      console.log('Response status:', response.status);

      const responseText = await response.text();
      console.log('Response raw text:', responseText);

      let result;
      try {
        result = JSON.parse(responseText);
        console.log('Response JSON result:', result);
      } catch (e) {
        console.error('JSON Parse error:', e);
        throw new Error(`Invalid server response: ${responseText.substring(0, 100)}...`);
      }

      if (response.ok && (result.success || result.analysis)) {
        setAnalysis(result.analysis);
      } else {
        throw new Error(result.error || 'Failed to analyze image');
      }
    } catch (error) {
      console.error('Analysis error:', error);
      Alert.alert('Error', `Failed to analyze image: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaProvider>
      <LinearGradient
        colors={['#0f0c29', '#302b63', '#24243e']}
        style={styles.container}
      >
        <StatusBar style="light" />
        <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
          <ScrollView contentContainerStyle={styles.scrollContent}>

            <View style={styles.header}>
              <Text style={styles.title}>FoodSense AI</Text>
              <Text style={styles.subtitle}>Smart Food Analysis</Text>
            </View>

            <View style={styles.cardContainer}>
              <BlurView intensity={80} tint="dark" style={styles.glassCard}>
                <View style={styles.imageContainer}>
                  {image ? (
                    <Image source={{ uri: image }} style={styles.previewImage} />
                  ) : (
                    <View style={styles.placeholder}>
                      <Text style={styles.placeholderText}>No Image Selected</Text>
                    </View>
                  )}
                  {loading && (
                    <View style={styles.loadingOverlay}>
                      <ActivityIndicator size="large" color="#6C63FF" />
                      <Text style={styles.loadingText}>Analyzing...</Text>
                    </View>
                  )}
                </View>

                <View style={styles.buttonGroup}>
                  <TouchableOpacity
                    style={[styles.button, styles.secondaryButton]}
                    onPress={pickImage}
                    disabled={loading}
                  >
                    <Text style={styles.buttonText}>Gallery</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.button, styles.primaryButton]}
                    onPress={takePhoto}
                    disabled={loading}
                  >
                    <Text style={[styles.buttonText, styles.primaryButtonText]}>Camera</Text>
                  </TouchableOpacity>
                </View>
              </BlurView>
            </View>

            {analysis && (
              <View style={styles.resultContainer}>
                <BlurView intensity={60} tint="dark" style={styles.resultCard}>
                  <Text style={styles.resultTitle}>Analysis Result</Text>
                  <Text style={styles.resultText}>{analysis}</Text>
                </BlurView>
              </View>
            )}

          </ScrollView>
        </SafeAreaView>
      </LinearGradient>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    paddingTop: Platform.OS === 'android' ? 30 : 0,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 50,
  },
  header: {
    alignItems: 'center',
    marginVertical: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    letterSpacing: 1,
  },
  subtitle: {
    fontSize: 16,
    color: '#ccc',
    marginTop: 5,
  },
  cardContainer: {
    borderRadius: 20,
    overflow: 'hidden',
    marginTop: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  glassCard: {
    padding: 20,
    alignItems: 'center',
  },
  imageContainer: {
    width: '100%',
    height: 300,
    borderRadius: 15,
    backgroundColor: 'rgba(0,0,0,0.3)',
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    marginBottom: 20,
  },
  previewImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: {
    color: 'rgba(255,255,255,0.5)',
    marginTop: 10,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  loadingText: {
    color: '#fff',
    marginTop: 10,
    fontSize: 16,
    fontWeight: '600',
  },
  buttonGroup: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 15,
    gap: 10,
  },
  button: {
    flex: 1,
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButton: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  primaryButton: {
    backgroundColor: '#6C63FF', // Vibrant purple accent
    width: '100%',
    flex: 0, // Reset flex for the full width button
    shadowColor: '#6C63FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 5,
  },
  disabledButton: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#E0E0E0',
    fontSize: 16,
    fontWeight: '600',
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 18,
  },
  resultContainer: {
    marginTop: 20,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  resultCard: {
    padding: 20,
  },
  resultTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
    paddingBottom: 10,
  },
  resultText: {
    color: '#E0E0E0',
    fontSize: 16,
    lineHeight: 24,
  },
});
