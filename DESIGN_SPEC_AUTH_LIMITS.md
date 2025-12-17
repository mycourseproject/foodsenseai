# FoodSense AI - Authentication & Usage Limits Design Spec

## 1. Overview
This document outlines the architectural design for user authentication, data isolation, and usage quotas (scans per month) for the FoodSense AI application.

## 2. Authentication Strategy
We will utilize **Firebase Authentication** to handle all three required access tiers.

### 2.1. Access Tiers
1.  **Guest / No Sign-In**:
    *   **Mechanism**: Firebase Anonymous Authentication.
    *   **User Experience**: User opens the app and starts scanning immediately without providing credentials.
    *   **Identity**: Uses a temporary UID assigned by Firebase. Data persists as long as the user doesn't clear app data or log out.
2.  **Signed-In (Free Tier)**:
    *   **Mechanism**: Google Sign-In and Sign in with Apple.
    *   **User Experience**: Standard OAuth flow.
    *   **Identity**: Permanent UID linked to their email/Apple ID.
3.  **Signed-In (Paid/Premium)**:
    *   **Mechanism**: Same as Free Tier, but with a specific flag/claim in their user profile indicating active subscription.

## 3. Usage Limits & Quotas

| User Tier | Monthly Scan Limit | enforcement Logic |
| :--- | :--- | :--- |
| **Guest** | **10 scans/month** | Tracked via Firestore counter |
| **Free User** | **25 scans/month** | Tracked via Firestore counter |
| **Premium** | **Unlimited** | Bypasses counter check |

### 3.1. Quota Reset Mechanism
*   Usage counters will reset automatically at the start of every billing cycle or calendar month.
*   **Implementation**: We store a `scanCount` and a `lastScanMonth` (e.g., "2023-10") in the user's profile. If the current month differs from `lastScanMonth`, we reset `scanCount` to 0 before processing the new scan.

## 4. Backend Data Isolation & Separation

To ensure clean architecture and privacy, we will strictly separate **User Identity/Metadata** from **Actual Application Data** (scans).

### 4.1. Cloud Storage Structure (Images)
Images uploaded for analysis will be stored in specific paths:

*   **Signed-In Users**:
    *   Path: `userdata/{userId}/scans/{timestamp}_{filename}`
    *   Access: Restricted to the specific `{userId}` via Storage Security Rules.
*   **Guest Users (Anonymous)**:
    *   Path: `guestdata/{anonUserId}/scans/{timestamp}_{filename}`
    *   Access: Restricted to the specific `{anonUserId}`.

### 4.2. Database Schema (Firestore)
We will use two distinct root-level collections to separate concerns.

#### A. User Information DB (Collection: `user_profiles`)
This collection strictly stores metadata, authentication state, and subscription info. No app data (scans) is stored here.

*   **Document ID**: `{uid}` (Matches Auth UID)
*   **Fields**:
    *   **Identity**:
        *   `authType`: "anonymous" | "google" | "apple"
        *   `email`: string (null for guests)
        *   `dateSignedIn`: timestamp (Date of account creation/first sign-in)
    *   **Subscription**:
        *   `status`: "free" | "paid"
        *   `datePaid`: timestamp (null if free)
        *   `isGuest`: boolean
    *   **Usage Tracking**:
        *   `currentMonth`: string (e.g., "2025-12")
        *   `scanCount`: number

#### B. Application Data DB (Collection: `scan_records`)
This collection stores the actual "food sense" data. It references the user but is kept separate from the profile.

*   **Document ID**: Auto-generated `{scanId}`
*   **Fields**:
    *   `ownerId`: string (Reference to `{uid}`)
    *   `imageUrl`: string
    *   `analysisResult`: string (The text from Gemini)
    *   `nutritionalInfo`: object
    *   `timestamp`: timestamp
    *   `isPrivate`: boolean (true by default)

## 5. API Flow (The "Enforcer")

The Cloud Function (`analyze-image`) will orchestrate this separation.

**Logic Flow:**
1.  **Receive Request**: API receives image and Auth Token.
2.  **Verify Auth**: Extract `uid` from token.
3.  **Fetch Metadata**: Read from `user_profiles/{uid}`.
4.  **Check Subscription & Quota**:
    *   Check `usage.currentMonth` vs now. Reset if needed.
    *   If `status` != 'paid' AND `scanCount` >= Limit -> **DENY** (403).
5.  **Execute Scan**:
    *   Upload image to Storage.
    *   Call Gemini API.
6.  **Store Data**:
    *   Write result to `scan_records` collection.
    *   Ideally, we index `scan_records` by `ownerId` for efficient retrieval.
7.  **Update Metadata**:
    *   Increment `scanCount` in `user_profiles/{uid}`.
8.  **Return Result**.

## 6. Migration from Anonymous to Signed-In
If a Guest user decides to sign in:
1.  Client invokes Firebase "Link Account".
2.  API updates `user_profiles/{uid}`:
    *   Set `authType` to "google"/"apple".
    *   Set `isGuest` to `false`.
    *   Update `dateSignedIn` to capture the conversion time.
3.  `scan_records` remain linked to the same `uid` (since Firebase preserves UID on link) OR we update `ownerId` if the UID changes.

## 7. Security Rules
*   **User Profiles**:
    `match /user_profiles/{userId} { allow read: if request.auth.uid == userId; }`
    *(Write access restricted to Admin SDK/Cloud Functions to prevent tampering with quotas)*
*   **Scan Records**:
    `match /scan_records/{scanId} { allow read: if resource.data.ownerId == request.auth.uid; }`
