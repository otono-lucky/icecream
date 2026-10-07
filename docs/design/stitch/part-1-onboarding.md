Design the onboarding and verification screens for a mobile dating app called icecream (iOS and Android, portrait phone).

WHO IT'S FOR
Single Nigerians aged 35 to 60: divorced, widowed, separated or never married, looking for a serious relationship, not casual dating. Many are uneasy about being seen on a dating app and wary of romance scams. The app is for men and women equally. It must not look or feel like a young people's swipe app.

FEEL
Calm, warm, dignified and trustworthy, like a well-run private members' club or a good bank's app, not a nightclub. Grown-up and quietly confident. No emoji, no confetti, no slang, no hearts or flames everywhere. Any photography shows mature Black Nigerian adults (35–60), well dressed, relaxed and natural, never young models and never sexualised.

VISUAL SYSTEM
- One warm accent colour for primary actions (suggest a deep rose, terracotta or plum) on a warm off-white background, with near-black text. Muted green for "verified" and "passed", amber for "in review", a soft red only for errors.
- Large, readable type for older eyes: body text at least 17pt, headings 28–32pt, a clean humanist sans-serif. High contrast (WCAG AA or better).
- Big touch targets (at least 48pt tall), full-width primary buttons at the bottom of the screen, generous spacing, rounded corners (12–16pt).
- A slim progress indicator across the top of the onboarding steps (6 steps: date of birth, about you, photos, selfie, ID, done).
- Every input shows its label above it and its error message below it in plain language.
- Design light mode first; include a dark mode version of the welcome and photos screens.

SCREENS (use this copy; you can tighten it but keep the meaning)

1. Welcome
Headline "Serious second chances." Subline "A verified community for single Nigerians over 35 who are ready for something real." Three short trust points with simple line icons: "Every member is verified", "Only people 35 and over", "You decide who sees you". Primary button "Get started", text button "I already have an account".

2. Phone number
Title "Your phone number". Subtitle "We'll text you a code. No email needed." One field with a fixed "+234" prefix and a Nigerian flag, placeholder "803 123 4567". Button "Send code". Error state: "Enter a Nigerian mobile number."

3. Enter code
Title "Enter your code". Subtitle "Sent by SMS to +234 803 123 4567" with an "Edit" link. Six separate digit boxes. Button "Verify". Below it a disabled "Resend code in 42s" that becomes an active "Resend code". Error state under the boxes: "That code isn't right. Check the SMS and try again."

4. Date of birth
Title "Your date of birth". Subtitle "Members are 35 and over. Your age shows on your profile, never your birthday." A native-style date picker (day, month, year wheels or a calendar sheet), not a free-text field. Helper text: "Please check it carefully. It can't be changed later." Button "Continue".

5. Not eligible (for under-35s)
Title "Thank you for your interest". Body "icecream is for members aged 35 and over, so we can't create an account for you right now. We'd be glad to welcome you when the time comes." One button "Close". Warm and respectful; not an error screen, no red.

6. About you
Title "About you". Fields: "First name"; "I am a" as two large segmented choices, "Woman" and "Man"; "City" with a searchable list of Nigerian cities (Lagos, Abuja, Port Harcourt, Ibadan, Enugu, Kano, Benin City…). Button "Continue".

7. Photos
Title "Add your photos". Subtitle "Add at least 2 clear, recent photos of yourself. You can add up to 6." A 3×2 grid of photo slots: filled slots show the photo with a small remove (×) button, and the first photo is labelled "Main"; empty slots show a "+" to add. Tips row: "Face clearly visible", "Just you, no group photos", "Taken in the last 2 years". Button "Continue", disabled until 2 photos. Show three states: empty, one photo, four photos.

8. Selfie check
Title "A quick selfie". Subtitle "Take a selfie now so we can match it to your photos." A card titled "Why we ask": "Every member passes this same check, so you know everyone you meet here is a real person. A person on our team compares it with your photos. Your selfie is never shown on your profile." A friendly illustration of a face in an oval frame. Button "Take my selfie". Also design the retry state: a calm notice at the top, "We couldn't confirm your last selfie", with the reviewer's reason underneath, e.g. "Your face wasn't clear. Try somewhere brighter."

9. ID (optional)
Title "Get your verified badge". Subtitle "Optional. You can skip this and do it later from your profile." A preview of the verified badge as it appears on a profile. Short text: "Members with an ID check show a verified badge, and others tend to take them more seriously. Only our review team sees your ID." Four selectable cards: "NIN slip or card", "Driver's licence", "International passport", "Voter's card". Primary button "Take a photo of my ID" (enabled after choosing a type), text button "Skip for now".

10. Verification pending
Title "We're checking your details". Subtitle "You can start browsing as soon as your check passes." A status list with icons: "Photo and selfie check — Being reviewed" (amber), "ID badge — Skipped" (grey), or "Being reviewed" if they submitted it. Note: "Usually done within 24 hours." Secondary button "Add my ID while I wait" (only when ID was skipped), text button "Check now". Reassuring, not anxious; a subtle illustration is fine.

Also include a small "Can't reach icecream" screen (no connection) with "Check your connection and try again." and a "Try again" button.

Keep all screens consistent in one design system, and show the shared components (buttons, inputs, choice cards, status rows, progress bar, notice card) on a separate components frame.
