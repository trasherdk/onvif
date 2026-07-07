# ONVIF IP camera recommendations

Suggestions for cameras that work well with this library and general ONVIF development — especially compared to budget app/P2P cameras (e.g. Yoosee/Gwell) that often expose only partial ONVIF.

## Important: “full ONVIF” does not exist off the shelf

ONVIF is organized into **profiles**, not one monolithic spec. Even certified devices implement specific profiles (S, T, G, M, …) and optional features within them.

For this project (Profile S–style usage: discovery, device/media/PTZ, events, imaging, optional recording/replay):

| Priority | Profiles | Why |
|----------|----------|-----|
| **Must** | **Profile S** | Streaming, PTZ, basic device/media — core of this library |
| **Very useful** | **Profile T** | H.265, imaging settings, richer events |
| **Nice to have** | **Profile G** | SD card / NVR search & replay (see `examples/example9.js`) |

Always verify the **exact model and firmware** on the official database:

**[ONVIF Conformant Products](https://www.onvif.org/conformant-products/)**

Ignore marketing labels like “ONVIF compatible” without a conformant listing — many cheap cameras only offer RTSP and broken SOAP.

---

## By budget / use case

### Best compliance (not cheap) — reference hardware for development

Best choice if you want discovery, digest auth, events, imaging, and OSD to behave predictably.

| Brand | Examples | Notes |
|-------|----------|--------|
| **Axis** | P32x / M30x (fixed), P5655-class PTZ (used/refurb) | Strong ONVIF; often the benchmark for client libraries |
| **Hanwha Wisenet** | X / Xplus fixed (e.g. XNV-8080R) or PTZ (e.g. XNP-6040H) | Very good Profile S/T support |
| **Bosch** | FLEXIDOME / DINION | Solid conformance; less common in home lab |

**Tip:** Used or refurb **Axis** / **Hanwha** (~$150–400) is often the best value for a “known good” dev camera.

---

### Mid-range — strong ONVIF on paper (still verify firmware)

| Brand | Examples | Typical price | Profiles (per datasheets) |
|-------|----------|---------------|---------------------------|
| **Uniview (UNV)** | EasyStar / Prime, e.g. **IPC325** fixed dome | ~$80–150 | S, T, G |
| **Dahua (international)** | **SD2C405** (4 MP, 5× PTZ) | ~$150–250 | S, T, G |

Good step up from no-name IPCs. PTZ models are useful for `examples/example3.js` and PTZ tests. Some advanced features may still require vendor CGI/SDK alongside ONVIF.

---

### Cheapest still usable for Profile S + basic PTZ

| Brand | Examples | Typical price | Expectations |
|-------|----------|---------------|--------------|
| **Amcrest** (Dahua rebadge) | **IP4M-1051** (PTZ), **IP5M-T** (fixed) | ~$50–120 | Connect, stream, basic PTZ — not full events/OSD/Profile G |
| **Reolink** | **RLC-423**, **TrackMix**, etc. | varies | Popular; Profile S on many models — events and advanced ONVIF are inconsistent |

Avoid generic “ONVIF” no-name cameras if the goal is spec coverage; they are usually RTSP plus incomplete SOAP.

---

## Practical setup for this repo

| Role | Suggestion |
|------|------------|
| **Primary dev / conformance camera** | Used **Axis** or **Hanwha** fixed dome |
| **Affordable PTZ lab camera** | **Dahua SD2C405** (or Amcrest PTZ equivalent) |
| **Quirky real-world test** | Keep a budget cam (e.g. Yoosee) for partial PTZ, P2P app, missing Profile G — not a conformance reference |

Before buying:

1. Search [ONVIF Conformant Products](https://www.onvif.org/conformant-products/) for the **exact SKU and firmware**.
2. Prefer listings with **Profile S + T** (and **G** if you care about recording/replay).
3. After purchase, confirm firmware matches the conformant entry (ONVIF ties conformance to a specific firmware version).

---

## What this library exercises vs typical budget cameras

| Feature | Good ONVIF camera | Typical Yoosee / budget IPC |
|---------|-------------------|-----------------------------|
| WS-Discovery | ✅ | ⚠️ Often flaky |
| Pan / tilt (ONVIF) | ✅ | ⚠️ May need workarounds (see `example3.js`) |
| Zoom (ONVIF) | ✅ if hardware supports | ❌ Often fixed lens |
| Events (Profile S) | ✅ | ❌ Often missing |
| Imaging / OSD | ✅ | ❌ Often missing |
| Recording / replay (Profile G) | ✅ on NVR / some IPCs | ❌ Usually app/P2P only |

---

## Further reading

- [Profile S](https://www.onvif.org/profiles/profile-s/) — basic streaming, PTZ, device/media
- [Profile T](https://www.onvif.org/profiles/profile-t/) — H.265, imaging, events
- [Profile G](https://www.onvif.org/profiles/profile-g/) — edge storage, search, replay
- [ONVIF Conformant Products](https://www.onvif.org/conformant-products/) — authoritative product lookup
