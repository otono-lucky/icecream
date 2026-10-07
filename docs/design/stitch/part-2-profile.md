Design the profile screens for icecream, a mobile dating app (iOS and Android, portrait phone), using the same design system as the onboarding and Today screens already in this project.

WHO IT'S FOR
Verified single Nigerians aged 35 to 60, divorced, widowed, separated or never married, looking for a serious relationship. At this stage of life people want the important things answered before a first date, not after three: marriage history, children, faith, where they live, and what they want. The profile must make these easy and dignified to answer, never awkward or judgemental.

FEEL
Calm, warm, private and respectful. Questions feel like a thoughtful friend asking, not a form. Big, tappable answer cards rather than tiny dropdowns. No emoji.

VISUAL SYSTEM (same as before)
- Colours: wine #9E3D48 for actions and selected states, ivory #FAF8F5 background, white cards, sand #F1ECE6 for secondary surfaces, verified green #2D6A4F (soft #DCEFE3), near-black text #1F1B18, muted #5F5751.
- Type: Plus Jakarta Sans. Body at least 17pt, titles 26pt bold.
- Rounded cards (16pt), touch targets at least 48pt, generous spacing.
- Single-choice answers are full-width cards with a radio on the right; the selected card turns white with a wine border and a check. Multi-line answers are a large text box with a character count.

SCREENS

1. Profile intro
Shown after sign-up, while the member waits for verification, and from their profile until it's complete.
Title "Let's build your profile". Subtitle "Six short sections, about 5 minutes. You can change any answer later."
A checklist of the six sections with small icons: Marital history, Children, Faith, Where you live, Work and daily life, What you're looking for.
Note card: "Complete profiles are the ones we introduce. Members here want to know these things before a first date."
Button "Start".

2. Marital history (section 1 of 6)
Progress bar with 6 segments at the top, back arrow, "Section 1 of 6".
Title "Your marital history". Subtitle "So others understand your situation without having to ask."
Answer cards: "Never married", "Divorced", "Separated", "Widowed".
When "Widowed" is selected, a gentle note appears under it: "We're sorry for your loss. This is shown simply as 'Widowed' on your profile."
Button "Continue".

3. Children (section 2 of 6)
Title "Children".
Question "Do you have children?" with cards "Yes" and "No".
If Yes: "How many?" as a row of pills 1, 2, 3, 4, 5+; "Do they live with you?" cards "Yes, all of them", "Some of them", "No, they live elsewhere or are grown".
Question "Are you open to a partner who has children?" cards "Yes", "Maybe", "No".
Button "Continue".

4. Faith (section 3 of 6)
Title "Faith".
"Your faith": cards "Christian", "Muslim", "Traditional", "Other", "No religion".
"How do you practise?": cards "Devout", "Practising", "Occasionally", "Not religious".
"How important is your partner's faith to you?": cards "It must match mine", "I'd prefer it to match", "It doesn't matter to me".
Button "Continue".

5. Where you live (section 4 of 6)
Title "Where you live". Subtitle "So distance doesn't waste anyone's time."
Show the city already chosen at sign-up (e.g. "Lagos") with a "Change" link.
"Would you relocate for the right person?": cards "Yes", "Maybe, for the right person", "No".
Button "Continue".

6. Work and daily life (section 5 of 6)
Title "Work and daily life".
Field "What do you do?" (e.g. "Pharmacist", "Runs a fashion business", "Retired civil servant").
Large text box "Describe a typical week" with placeholder "Weekdays at the pharmacy, Saturdays at the market, Sundays with family and church…" and a counter "0 / 300".
Button "Continue".

7. What you're looking for (section 6 of 6)
Title "What you're looking for". Subtitle "Clear intentions from the start."
Cards: "Marriage", "A committed relationship", "Companionship".
Large text box "In your own words" with placeholder "A kind, steady partner to build a calm, shared life with…" and a counter "0 / 500".
Button "Preview my profile".

8. Profile preview
Title "This is how others will see you".
A full member profile (as in screen 10 below) built from the answers, with an "Edit" link on each section.
Button "Publish my profile", text button "Make changes".

9. My profile (the "Me" tab)
Top: main photo (round), first name and age, city, verification badges ("Photo verified", "ID verified").
A profile strength bar: "Profile 4 of 6 complete" with "Finish your profile" when incomplete.
A horizontal strip of the member's photos with "Edit photos".
Each section as a card showing the answers, with an "Edit" link: Marital history, Children, Faith, Where you live, Work and daily life, What you're looking for.
"Still to do" card when the ID badge is missing: "Add a government ID to earn your verified badge" with an "Add ID" button.
Row "Preview my profile", row "Settings".

10. Member profile (what others see)
Large photo carousel at the top (swipe left/right, bars showing the count), name and age, city with pin, badges.
A row of key facts as chips: "Divorced", "2 children, live with her", "Christian · Practising", "Open to relocating".
Sections: "What she's looking for" (intent + her own words), "Work and daily life", "Faith" (including how important a partner's faith is), "Children" (including whether she's open to a partner with children).
"Why we suggested her" chip.
Bottom actions bar: round Pass (×), "Message" (secondary), round Interested (heart). Small "Report" and "Block" links at the very bottom.

11. Edit a section
Same layout as the section screens above, prefilled with the member's answers, with "Save" instead of "Continue" and a back arrow.

Keep every screen consistent with the existing onboarding and Today designs, and add any new components (answer cards, pill rows, text box with counter, fact chips, profile strength bar) to the shared components frame.
