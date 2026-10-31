# GOSHTI — store readiness (Apple App Store + Google Play)

Status as of 31 Oct 2026. ✅ done · 🟡 needs Rohan · 🔧 needs code (Claude)

## Already in the app
- ✅ No accounts, ads, analytics, tracking or third-party SDKs that collect data.
- ✅ Parent mode is behind a parent check (maths question). Nothing child-facing links out or sells.
- ✅ Plans/prices are hidden in store builds (`showPlans` is off unless a test build) — the stores reject buttons that cannot buy.
- ✅ Parent "delete everything on this phone".
- ✅ Child cannot chat with AI; safety screen before the AI and a critic after; fixed Marathi decline messages.
- ✅ Bundle ids set (`com.aajichipeti.app`), icon + Android adaptive icons, `ITSAppUsesNonExemptEncryption: false`.

## Blockers before submitting
1. 🔧 **Server limit per device.** Anyone with the app's public key can call the story server and spend your Google money. Add a per-device daily cap (and a global daily cap) on the server. Needs a small Supabase table.
2. 🟡 **Developer accounts:** Apple Developer Program (US$99/yr) and Google Play Console (US$25 once). Google *personal* accounts created after 13 Nov 2023 must run a **closed test with ≥12 testers opted in for 14 days in a row** before production — start this first. (An organisation account avoids it; needs a D-U-N-S number.)
3. 🟡 **Privacy policy at a public web address** (draft: `docs/store/PRIVACY_POLICY.md`; fill the brackets). Both stores need the link. Also a **support email**.
4. 🟡 **Written confirmation from Google Cloud** that a children's app can use Vertex AI (earlier open item) — keep it with the submission notes.
5. 🔧 **Report a problem** for AI stories (Google Play's AI-content policy asks for an in-app way to report offensive AI content): a parent-gated "report this story" that opens an email to the support address.
6. 🟡 **Supabase Pro** + a Google Cloud **budget alert and quota** before real users.
7. 🟡 Decide **iPad**: `supportsTablet` is true, which means iPad screenshots. Setting it false shrinks the work (I recommend false for v1).

## Store forms (answers)
- **Audience:** children. Apple: Kids Category age band "5 and under" (or 6–8 if you prefer; Apple needs one band). Google: Designed for Families, target ages 0–5 and 6–8 (+9–12 optional).
- **Data collected:** child's first name, age, gender (boy/girl), story idea text. Purpose: app functionality only. Shared with Google Cloud as processor. Not used for ads, analytics or tracking. Deletable by parent.
- **Ads:** none. **Purchases:** none in v1. **Account:** none. **UGC:** no sharing between users.
- **AI disclosure:** stories and voice are AI-generated; child cannot converse with it.
- **Age rating:** expect 4+ (Apple) / Everyone (IARC). No violence, no web access, no user interaction.
- **Review notes (paste):** "No login needed. Child sets a first name and age; Home has story categories. 'आजीने गोष्ट निवडावी' plays a ready-made library story offline; 'माझ्या कल्पनेची गोष्ट' sends a short idea to our server to write a new story with Google Vertex AI. The child cannot ask the AI questions; unsafe or non-story ideas get a fixed decline message. Parent mode is behind a maths gate. No purchases in this version."

## Store listing (draft)
- **Name:** गोष्टी — Aaji's Marathi Stories
- **Subtitle / short description:** आजीच्या गोष्टी, तुमच्या कल्पनेतून. (Marathi bedtime and play-time audio stories for kids 2–9.)
- **Needed:** 1024×1024 icon ✅; phone screenshots (at least 2–8; 6.9" iPhone + 6.5" if asked); Google feature graphic 1024×500; support URL; privacy URL.

## Build + submit (after the blockers)
1. `eas build --platform android --profile production` (AAB) and `--platform ios --profile production`; production env must carry the story-server URL and anon key (`npm run eas:env`).
2. Upload AAB to a **closed test** first (Google), TestFlight first (Apple), check on real phones: voice, hero name, limit screen, delete-data, parent gate.
3. `eas submit` or upload by hand; fill the forms above.
