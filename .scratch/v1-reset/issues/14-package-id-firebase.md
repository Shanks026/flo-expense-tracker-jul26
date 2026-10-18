# Permanent package id and Firebase re-registration

Map: [../map.md](../map.md)
Type: task
Labels: wayfinder:task
Status: open
Blocked by: 

## Question

Choose and register FLO's permanent Android package id, replacing `com.anonymous.flo`:
1. Add a Firebase Android app for the new id.
2. Replace `google-services.json`.
3. Upload the FCM V1 key to EAS.
4. Set `android.package`.
5. Record the Google OAuth client changes this needs.

HITL: the human does the console steps from a `wizard` checklist.

Resolved when the id is chosen and registered. The answer records the id and where each credential lives.

Refs: audit §6 P0 package name, Launch sequence step 1.
