# Architecture Document: Mile Mint

## 1. App Overview
Mile Mint is a vehicle expense and maintenance tracker application. Built as an Android-first application using React Native and Expo, its core value proposition is to provide users with a comprehensive set of vehicle management tools while remaining completely free forever, achieved by maintaining zero backend computing or storage costs.

## 2. Tech Stack
The project utilizes the following technologies (derived from `package.json`):
- **Framework**: React Native (0.81.5), Expo (SDK 54.0.33)
- **Language**: TypeScript (5.3.3)
- **State Management**: Zustand (4.5.4). Utilizes a centralized store in `context/useStore.ts` managing user session, selected vehicles, language, currency, and dark mode states.
- **Backend/Database**: Firebase (10.12.2). Specifically uses Firebase Authentication and Firestore. 
  - *Note: Firebase Cloud Functions and Firebase Storage are deliberately NOT used in order to avoid recurring cloud infrastructure costs.*
- **AI Integration**: Google Gemini (`gemini-2.5-flash`)
- **Notifications**: `expo-notifications` for local reminders; Firebase Cloud Messaging (`firebase/compat/messaging`) combined with Expo device handling for admin announcements.
- **PDF Generation**: `expo-print`, `expo-file-system`, and `expo-sharing`
- **Charts**: `react-native-gifted-charts` (1.4.76)
- **Navigation**: `@react-navigation/native` and `@react-navigation/native-stack`
- **Other Key Packages**: 
  - `i18next` & `react-i18next`: Internationalization and translation support.
  - `@react-native-async-storage/async-storage`: Persistent local storage.
  - `expo-image-picker`: Managing local image selections.
  - `@react-native-community/datetimepicker`: Date selection.

## 3. Complete Feature List
- **Fuel Logging & Mileage Calculation**: Implemented in `screens/FuelScreen.tsx`. Calculates average mileage based on liters added and odometer readings. Reads and writes to the `expenses` collection with `category: 'Fuel'`.
- **Expense Logging**: Implemented in `screens/ExpenseListScreen.tsx`. Allows users to log various expenses (Mechanical, Electrical, BodyWork, Tax, Other). Reads and writes to the root `expenses` collection.
- **Service/Oil Change Logging**: Implemented in `screens/OilChangeScreen.tsx`. Tracks maintenance dates and logs costs. Reads and writes to the root `expenses` collection with `category: 'OilChange'`.
- **Finance/EMI Tracking**: Implemented in `screens/FinanceScreen.tsx`. Tracks car loan details including down payment, EMI amounts, and due dates. Reads and writes to the root `expenses` collection with `category: 'Finance'`.
- **Finance Due-Date Local Notifications**: Handled in `utils/financeReminders.ts`. Schedules local push notifications using `expo-notifications` to remind users of upcoming EMI payments.
- **Admin Announcements (FCM)**: Configured in `App.tsx` and detailed in `ADMIN_NOTES.md`. Uses Firebase Cloud Messaging topic subscriptions (`'announcements'`) to receive global push notifications.
- **Dark/Light Theme Toggle**: Managed globally via Zustand in `context/useStore.ts` and persisted in `AsyncStorage`. Applied across components using `hooks/useThemeColors.ts`.
- **Multi-language Support**: Handled via `i18next`. Supported languages are toggled in `useStore.ts` (defaulting to English).
- **Multi-currency Support**: Configured via Zustand in `context/useStore.ts` (e.g., defaulting to 'PKR'). 
- **Pie Chart / Expense Breakdown**: Rendered in `screens/CarDashboardScreen.tsx`. Aggregates data from the `expenses` collection and displays a breakdown using `react-native-gifted-charts`.
- **PDF Export**: Implemented in `utils/exportReport.ts`. Generates a full HTML report of a vehicle's expenses and converts it to a shareable PDF using `expo-print` and `expo-sharing`.
- **About Screen**: Implemented in `screens/AboutScreen.tsx`. Displays developer information, app version, and relevant links.
- **App Version Check System**: Implemented in `utils/versionCheck.ts`. Cross-references the local app version with a remote version stored in the `appConfig/versionInfo` Firestore document and prompts for updates.
- **Car Doctor AI Assistant**: Implemented in `utils/carDoctorApi.ts` and `components/CarDoctorModal.tsx`. Provides AI-driven troubleshooting for car issues.
- **Monthly AI Summary**: Implemented in `utils/monthlyAiSummary.ts`. Analyzes the month's spending and provides a friendly text summary.
- **Onboarding Screens**: Implemented in `screens/OnboardingScreen.tsx`. A walkthrough for first-time users, with completion status stored in `AsyncStorage`.

## 4. AI Usage — Detailed Breakdown
**Model Used:** `gemini-2.5-flash`

### Car Doctor (`utils/carDoctorApi.ts`)
- **Invocation**: Triggered manually by the user describing a car problem.
- **Data Sent to AI**: Only the user's raw text input string (the car problem description). No personal user data is sent.
- **Prompt Instructions**: Instructs the AI to act as a car troubleshooting assistant, providing 2-3 brief, general reasons in plain language (no markdown), under 80 words, ending with a strict disclaimer to consult a qualified mechanic.
- **Processing**: The raw text response is parsed from `candidates[0].content.parts[0].text` and displayed directly.
- **Caching**: No caching is implemented for these ad-hoc queries.
- **Rate Limiting**: Limited to 5 requests per day per user. 
  - **Mechanism**: The count is stored in Firestore at `users/{userId}/carDoctorUsage/{yyyy-mm-dd}`. The `checkUsage` function reads this document before allowing a request, and `incrementUsage` increments the counter post-success.
- **Fallback Behavior**: Throws a generic Error if the network fails or if the API key is misconfigured.

### Monthly AI Summary (`utils/monthlyAiSummary.ts`)
- **Invocation**: Triggered when viewing the dashboard to summarize recent expenses.
- **Data Sent to AI**: A JSON object containing: `vehicleName`, `month` (string), `totalSpent` (number), `previousMonthSpent` (number), `fuelSpent` (number), `avgMileage` (number), `overduePayments` (number), and `oilChangeStatus` (string heuristic).
- **Prompt Instructions**: Instructs the AI to write a warm, 3-sentence summary of the user's spending for the month in the user's selected language, mentioning one positive thing and one area to watch, kept under 60 words.
- **Processing**: The text response is extracted and trimmed.
- **Caching**: 
  - **Strategy**: Heavily cached to reduce API calls. Checked via `getOrGenerateMonthlySummary`.
  - **Firestore Path**: `users/{userId}/vehicles/{vehicleId}/monthlySummaries/{yyyy-mm}`. If this document exists, the cached text is used instead of calling the API.
- **Rate Limiting**: Implicitly rate-limited to once per month per vehicle due to the caching strategy.
- **Fallback Behavior**: If the API fails (e.g., due to 429 quota exceeded or 503 unavailability), the app catches the error and generates a deterministic local string based on `totalSpent` vs `previousMonthSpent` using a predefined language template.

### Free Tier Cost Math
With a daily limit of 5 Car Doctor requests and 1 Monthly Summary per vehicle:
- 100 active users with 1 vehicle each making maximum Car Doctor requests = (100 * 5) + 100/30 = ~503 requests/day.
- This is well within the Gemini API free tier limits (typically 1,500 requests per day for Flash), ensuring zero API costs at scale.

## 5. Data Architecture
Data is managed via root-level and nested Firestore collections.

- `users` (Collection)
  - `uid` (Document ID)
    - Fields: `uid` (string), `name` (string), `email` (string), `maxVehicles` (number), `status` (string).
    - `carDoctorUsage` (Sub-collection)
      - `yyyy-mm-dd` (Document ID) -> Fields: `count` (number)
    - `vehicles` (Sub-collection)
      - `vehicleId` (Document ID)
        - `monthlySummaries` (Sub-collection)
          - `yyyy-mm` (Document ID) -> Fields: `summaryText` (string), `generatedAt` (timestamp)
- `cars` (Root Collection)
  - Fields: `id`, `userId`, `name`, `model`, `year`, `regNumber`, `plate`, `engineCC`, `mileage`, `purchasePrice`, `imageUrl`, `type`.
- `expenses` (Root Collection)
  - Fields: `id`, `carId`, `category` (string: Fuel, Finance, OilChange, etc.), `date` (ISO string), `amount` (number), `workName` (string), `status` (string), `liters` (optional number), `odometer` (optional number).
- `appConfig` (Root Collection)
  - `versionInfo` (Document ID) -> Fields: `latestVersion`, `updateMessage`, `downloadUrl`.

*Note: No `firestore.rules` file was found in the repository root, indicating security rules are either managed directly in the Firebase Console or are currently open/testing.*

## 6. Admin vs User Access
- **Admin Determination**: Admin access is granted via a hardcoded email check in `App.tsx`: `user?.email?.toLowerCase() === 'chaudhrysamie@gmail.com'`.
- **Admin Capabilities**: Admins have access to the `AdminDashboardScreen`, which aggregates app-wide statistics (Total Users, Active Users, Total Vehicles, Total Expenses Amount) by reading the entire `users`, `cars`, and `expenses` collections. Admins can also edit the `versionInfo` configuration via a modal in the app.
- **Admin Announcements**: There is **no in-app UI** for composing global FCM announcements. As noted in `ADMIN_NOTES.md`, global announcements must be sent manually via the Firebase Console to the `announcements` topic. This design choice explicitly avoids the complexity and maintenance of building an admin messaging interface.
- **User Capabilities**: Standard users can manage their own cars and expenses. They do not have access to the Admin stack.

## 7. Cost & Efficiency Strategy
The app is architected specifically to eliminate backend hosting and server costs for the owner:
- **No Cloud Functions**: All complex aggregations, logic, and external API requests (e.g., Gemini API) are executed on the client-side within the React Native app.
- **No Cloud Storage**: The application intentionally avoids Firebase Cloud Storage to prevent bandwidth and storage fees. (Images are likely kept locally or converted to Base64 strings, given the absence of Cloud Storage imports).
- **Gemini Free Tier Optimization**: API limits are strictly enforced on the client side (5 Car Doctor requests/day via Firestore counter, 1 Monthly Summary request/month via Firestore caching). This ensures usage remains well below Google Gemini's free tier thresholds.
- **Lean Data Model**: Instead of complex relational joins on a server, data is kept flat (root `cars` and `expenses`), allowing the client app to simply fetch all expenses for a specific `carId` and aggregate them locally for charts and reports.

## 8. Navigation & Screen Flow
The app uses a Stack Navigator defined in `App.tsx`:
- **Initial Load**: `AppSplashScreen`
- **Auth Flow**: `Onboarding` -> `Login` <-> `Signup`
- **Main Flow**: 
  - `Home` (Dashboard listing all user's vehicles)
  - -> `AddCar` (Create/Edit a vehicle)
  - -> `CarDashboard` (Main hub for a selected vehicle, showing pie charts and the monthly AI summary)
    - -> `Fuel` (Fuel logs)
    - -> `ExpenseList` (General expenses)
    - -> `OilChange` (Maintenance logs)
    - -> `Finance` (EMI tracking)
  - -> `About` (Developer information)
- **Admin Flow** (If authorized): `AdminDashboard` -> `AdminUsers` / `AdminNotifications`.

## 9. Known Limitations
- **No Offline Support**: Without an explicit offline-first architecture or backend syncing engine (other than default Firebase persistence, which isn't explicitly configured for full offline mutation resolution), the app requires a stable internet connection for most features.
- **AI Summary Refresh**: The monthly AI summary is highly cached and is designed to only refresh once per month automatically, meaning users will not see mid-month updates to their AI summary without a force regeneration.
- **Root-level Collections**: `expenses` and `cars` are kept at the root rather than nested under users, which requires the client to rely strictly on `userId` and `carId` queries.
- **Admin Security**: The admin check relies on a hardcoded email on the client side. A more robust implementation would utilize Firebase Custom Claims to prevent bypassing the client-side check.
