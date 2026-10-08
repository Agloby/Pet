# Kern — Armand OS companion

Prepared 7 October 2026. Status: concept and generation preparation; not created or selected.

## Identity
Kern is a warm, alert robot meerkat: sand-coloured ceramic body, charcoal eye patches, amber eyes and a teal chest inset. The watchful helper concept draws on Armand's previously recorded interest in a Home Server and Family AI. Those prior plans are inspiration, not a claim of deployed integrations.

## Requested experience
One persistent Tamagotchi-like companion accessible from iPhone, Garmin watch and laptops. The animated ChatGPT Work pet is one presentation of the character; the available Pets tools do not supply a care simulation or a shared external state service.

## Proposed first version
- Feed, play, rest and check in; maintain energy, hunger, mood and bond.
- Persist state and event timestamps centrally behind account authentication so devices see the same companion.
- Offer a responsive phone/laptop interface, with explicit offline and last-synced status.
- Build a compatible Garmin Connect IQ app for viewing status and quick care actions after confirming the model.
- Use elapsed time for gentle state changes; no irreversible death, punitive streaks or guilt-based notifications.
- Keep work integration optional: explicitly completed tasks can reward growth. Do not claim access to Armand OS projects or health data without a real connection.

## Technical boundaries
Pets supports creating and selecting a validated animated sprite in ChatGPT Work mode. Its exposed tools do not offer feeding, ageing, arbitrary behaviour or an API to synchronize game state. A separate app and authenticated backend would implement those capabilities. Garmin compatibility, screen constraints and connectivity must be verified for the user's model. A deployed HTTPS service, device pairing and physical-device testing remain required for cross-device delivery.

## Evidence
Garmin app types: https://developer.garmin.com/connect-iq/connect-iq-basics/app-types/
Garmin communications: https://developer.garmin.com/connect-iq/api-docs/Toybox/Communications.html

## Current checkpoint
The bundled Pets preparation script succeeded, creating the request, generation jobs, prompts and layout guides locally. Base image generation has been requested. No pet upload, creation or selection has occurred. ChatGPT Library tools are unavailable in this session; the create-pet skill requires Library artifacts before upload. The exact Garmin model is pending.

Base concept image generated successfully using the built-in image generator and saved as Kern-concept.png. Prompt saved as Kern-image-prompt.md. Animation and activation remain incomplete.

Device confirmed: iPhone and Garmin Forerunner 970. Garmin's current compatibility table lists the 970 with a 454 x 454 round AMOLED screen and Connect IQ 6.0. Its manual confirms downloadable apps and glances. This supports a custom companion development path, not a claim that Kern already runs on the watch. Sources: https://developer.garmin.com/connect-iq/compatible-devices/ and https://www8.garmin.com/manuals/webhelp/GUID-025D75CF-3445-49E1-8D81-1AA74AB4E00F/EN-US/GUID-A220800C-E71B-40EC-B1D2-D3BCFB50EFCB.html

## Superseding character decision — 7 October 2026
User requested a great white shark instead of the robot meerkat. The shark is now the active concept. Initial shark artwork generated with the built-in image generator and saved as Kern-great-white-concept.png; prompt is Kern-great-white-prompt.md. Kern remains a provisional name. Original concept retained as history. Shark animations, QA reports, Library saving, pet creation and selection are not complete.
