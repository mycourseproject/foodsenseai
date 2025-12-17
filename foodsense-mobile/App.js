import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, TouchableOpacity, Image, ActivityIndicator, ScrollView, Alert, Platform, Modal } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { BlurView } from 'expo-blur';
import { useState, useEffect } from 'react';
import { auth } from './firebaseConfig';
import {
  signInAnonymously,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithCredential,
  linkWithCredential,
  signOut,
  OAuthProvider
} from 'firebase/auth';
import * as WebBrowser from 'expo-web-browser';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import * as AppleAuthentication from 'expo-apple-authentication';

WebBrowser.maybeCompleteAuthSession();

const API_URL = "https://api-2rzo5otiva-uc.a.run.app/analyze-image";

// PLACEHOLDER: You must replace this with your actual Web Client ID from Firebase Console
// Go to Authentication -> Sign-in method -> Google -> Web SDK configuration
const GOOGLE_WEB_CLIENT_ID = "121595916134-m6gc5ldil51p4ng4joiig3gesubhepa3.apps.googleusercontent.com";
const ANDROID_CLIENT_ID = "121595916134-9inmq8nmj5nicke558k3g8t3caj4vmee.apps.googleusercontent.com";

export default function App() {
  const [image, setImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authModalVisible, setAuthModalVisible] = useState(false);

  // Configure Google Sign-In
  useEffect(() => {
    GoogleSignin.configure({
      webClientId: GOOGLE_WEB_CLIENT_ID, // Required for ID token
    });
  }, []);

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
      if (currentUser) {
        console.log("User is signed in:", currentUser.uid, "Is Anonymous:", currentUser.isAnonymous);
        setAuthModalVisible(false); // Close modal on success
      } else {
        console.log("User is signed out, signing in anonymously...");
        signInAnonymously(auth).catch(e => {
          console.log("Anonymous Sign-In Failed (Check Firebase Console):", e.message);
        });
      }
    });

    return unsubscribe;
  }, []);

  const handleSignIn = async (credential, providerName) => {
    // if (!auth.currentUser) return; // Removed to allow direct sign-in

    setLoading(true);
    try {
      // Try to link first if we have an anonymous user
      if (auth.currentUser && auth.currentUser.isAnonymous) {
        console.log(`Linking ${providerName} credential to anonymous account...`);
        await linkWithCredential(auth.currentUser, credential);
        Alert.alert("Success", `Account linked with ${providerName}! You now have 25 scans/month.`);
      } else {
        // Direct sign in
        await signInWithCredential(auth, credential);
      }
    } catch (error) {
      console.log("Link failed, trying direct sign in:", error.code);
      if (error.code === 'auth/credential-already-in-use') {
        // Account exists, just sign in
        try {
          await signInWithCredential(auth, credential);
          Alert.alert("Welcome Back", "Signed in to your existing account.");
        } catch (signInError) {
          Alert.alert("Error", signInError.message);
        }
      } else {
        Alert.alert("Auth Error", error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAppleSignIn = async () => {
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      const { identityToken } = credential;
      if (identityToken) {
        const provider = new OAuthProvider('apple.com');
        const authCredential = provider.credential({
          idToken: identityToken,
          rawNonce: credential.nonce,
        });
        handleSignIn(authCredential, "Apple");
      }
    } catch (e) {
      if (e.code === 'ERR_CANCELED') {
        // cancelled
      } else {
        Alert.alert("Apple Sign-In Error", e.message);
      }
    }
  };

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 1,
      });

      if (!result.canceled) {
        const imageUri = result.assets[0].uri;
        setImage(imageUri);
        setAnalysis(null);
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
        allowsEditing: false,
        quality: 1,
      });

      if (!result.canceled) {
        const imageUri = result.assets[0].uri;
        setImage(imageUri);
        setAnalysis(null);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to take photo');
    }
  };

  const handleAnalyzePress = async () => {
    if (image) {
      await analyzeImage(image);
    }
  };

  const analyzeImage = async (imageUri) => {
    const uriToAnalyze = imageUri || image;
    if (!uriToAnalyze) return;

    if (!user) {
      Alert.alert("Authentication Error", "You must be signed in to analyze images.");
      return;
    }

    setLoading(true);
    setAnalysis(null);

    try {
      console.log('Starting image analysis for:', uriToAnalyze);

      // Get ID Token
      const token = await user.getIdToken();

      const formData = new FormData();
      const uriParts = uriToAnalyze.split('/');
      const filename = uriParts[uriParts.length - 1];

      let mimeType = 'image/jpeg';
      if (filename.toLowerCase().endsWith('.png')) mimeType = 'image/png';
      else if (filename.toLowerCase().endsWith('.webp')) mimeType = 'image/webp';

      formData.append('image', {
        uri: Platform.OS === 'android' ? uriToAnalyze : uriToAnalyze.replace('file://', ''),
        type: mimeType,
        name: filename || 'photo.jpg',
      });

      const response = await fetch(API_URL, {
        method: 'POST',
        body: formData,
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${token}`
        },
      });

      console.log('Response status:', response.status);
      const responseText = await response.text();

      let result;
      try {
        result = JSON.parse(responseText);
      } catch (e) {
        if (!response.ok) throw new Error(responseText);
        throw e;
      }

      if (response.ok) {
        setAnalysis(result.analysis);
      } else {
        throw new Error(result.error || result.message || 'Failed to analyze image');
      }
    } catch (error) {
      console.error('Analysis error:', error);
      Alert.alert('Analysis Failed', error.message);
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color="#6C63FF" />
      </View>
    );
  }

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
              <View style={styles.badgeContainer}>
                {(!user || user.isAnonymous) ? (
                  <TouchableOpacity style={styles.guestBadge} onPress={() => setAuthModalVisible(true)}>
                    <Text style={styles.badgeText}>{!user ? "Sign In" : "Guest (10 scans)"} • Upgrade</Text>
                  </TouchableOpacity>
                ) : (
                  <View style={styles.premiumBadge}>
                    <Text style={styles.badgeText}>Full Access (25 scans)</Text>
                  </View>
                )}
              </View>
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
                    style={[styles.button, styles.secondaryButton]}
                    onPress={takePhoto}
                    disabled={loading}
                  >
                    <Text style={styles.buttonText}>Camera</Text>
                  </TouchableOpacity>
                </View>

                {image && !analysis && (
                  <TouchableOpacity
                    style={[styles.button, styles.primaryButton, { marginTop: 10 }]}
                    onPress={handleAnalyzePress}
                    disabled={loading}
                  >
                    <Text style={[styles.buttonText, styles.primaryButtonText]}>Analyze Food</Text>
                  </TouchableOpacity>
                )}
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

            {!user?.isAnonymous && (
              <TouchableOpacity
                style={{ marginTop: 30, alignSelf: 'center' }}
                onPress={() => signOut(auth)}
              >
                <Text style={{ color: '#aaa' }}>Sign Out</Text>
              </TouchableOpacity>
            )}

          </ScrollView>
        </SafeAreaView>

        {/* Upgrade / Sign-In Modal */}
        <Modal
          animationType="slide"
          transparent={true}
          visible={authModalVisible}
          onRequestClose={() => setAuthModalVisible(false)}
        >
          <BlurView intensity={90} tint="dark" style={styles.modalContainer}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Upgrade Account</Text>
              <Text style={styles.modalText}>Sign in to save your scans and get more usage (25 scans/mo).</Text>

              <TouchableOpacity
                style={[styles.authButton, { backgroundColor: '#DB4437' }]}
                onPress={async () => {
                  try {
                    await GoogleSignin.hasPlayServices();
                    const userInfo = await GoogleSignin.signIn();
                    const idToken = userInfo.data?.idToken;
                    if (idToken) {
                      const credential = GoogleAuthProvider.credential(idToken);
                      handleSignIn(credential, 'Google');
                    }
                  } catch (error) {
                    console.log('Google Sign-In Error:', error);
                    Alert.alert("Error", "Google Sign-In failed.");
                  }
                }}
              >
                <Text style={styles.authButtonText}>Sign in with Google</Text>
              </TouchableOpacity>

              {Platform.OS === 'ios' && (
                <AppleAuthentication.AppleAuthenticationButton
                  buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
                  buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
                  cornerRadius={12}
                  style={{ width: '100%', height: 50, marginTop: 15 }}
                  onPress={handleAppleSignIn}
                />
              )}

              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setAuthModalVisible(false)}
              >
                <Text style={styles.closeButtonText}>Continue as Guest</Text>
              </TouchableOpacity>
            </View>
          </BlurView>
        </Modal>

      </LinearGradient>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f0c29' },
  safeArea: { flex: 1, paddingTop: Platform.OS === 'android' ? 30 : 0 },
  scrollContent: { padding: 20, paddingBottom: 50 },
  header: { alignItems: 'center', marginVertical: 20 },
  title: { fontSize: 32, fontWeight: 'bold', color: '#fff', letterSpacing: 1 },
  badgeContainer: { marginTop: 10 },
  guestBadge: { backgroundColor: '#444', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#666' },
  premiumBadge: { backgroundColor: '#6C63FF', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 20 },
  badgeText: { color: '#fff', fontSize: 13, fontWeight: '600' },

  cardContainer: { borderRadius: 20, overflow: 'hidden', marginTop: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  glassCard: { padding: 20, alignItems: 'center' },
  imageContainer: { width: '100%', height: 300, borderRadius: 15, backgroundColor: 'rgba(0,0,0,0.3)', overflow: 'hidden', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', marginBottom: 20 },
  previewImage: { width: '100%', height: '100%', resizeMode: 'contain' },
  placeholder: { alignItems: 'center', justifyContent: 'center' },
  placeholderText: { color: 'rgba(255,255,255,0.5)', marginTop: 10 },

  loadingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', zIndex: 10 },
  loadingText: { color: '#fff', marginTop: 10, fontSize: 16, fontWeight: '600' },

  buttonGroup: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', gap: 10 },
  button: { flex: 1, paddingVertical: 15, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  secondaryButton: { backgroundColor: 'rgba(255,255,255,0.15)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  primaryButton: { backgroundColor: '#6C63FF', width: '100%', shadowColor: '#6C63FF', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 5, elevation: 5 },
  buttonText: { color: '#E0E0E0', fontSize: 16, fontWeight: '600' },
  primaryButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 18 },

  resultContainer: { marginTop: 20, borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  resultCard: { padding: 20 },
  resultTitle: { fontSize: 22, fontWeight: 'bold', color: '#fff', marginBottom: 15, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.1)', paddingBottom: 10 },
  resultText: { color: '#E0E0E0', fontSize: 16, lineHeight: 24 },

  modalContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { width: '100%', backgroundColor: '#24243e', borderRadius: 20, padding: 30, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  modalTitle: { fontSize: 24, fontWeight: 'bold', color: '#fff', marginBottom: 10 },
  modalText: { color: '#ccc', textAlign: 'center', marginBottom: 30 },
  authButton: { width: '100%', paddingVertical: 15, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginVertical: 8 },
  authButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  closeButton: { marginTop: 20 },
  closeButtonText: { color: '#aaa', fontSize: 14 }
});
