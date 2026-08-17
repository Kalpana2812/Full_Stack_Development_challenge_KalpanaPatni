# Peblo TV Mini: CMS Validation Remediation Guide

## Assignment status and remaining work

Peblo TV Miniનું functional implementation complete છે. Viewer browse experience, protected CMS, image validation, current-data validation, atomic catalogue publish, Docker Compose, CI, documentation, and the parallel FastAPI/PostgreSQL API path are present in the submitted codebase. CMS validation errors **deliberate seed-data editorial issues** છે; તેઓ software bugs નથી. તેમ છતાં catalogue publish પહેલાં તેમને editorially correct કરવાના રહેશે.

| Area | Status | Practical note |
|---|---|---|
| Viewer, search, filters, show detail, and Season 0 trailer exclusion | Complete | `http://localhost:3000` પર viewer ચાલે છે. |
| CMS CRUD, local admin login, and server-side editor/admin authorization | Complete | `http://localhost:3000/cms` પર CMS ઉપલબ્ધ છે. |
| Existing-episode remediation | Complete | Episode libraryમાં **pencil** button existing episodeને editorમાં load કરે છે. |
| Artwork validation and upload targeting | Complete | Thumbnail માટે explicit episode dropdown છે; server episode ownership પણ verify કરે છે. |
| Live validation and atomic publish | Complete | દરેક save/upload પછી report current CMS data પરથી ફરી બને છે. |
| Docker Compose, FastAPI/PostgreSQL path, CI, health, and handoff documents | Complete | FastAPI docs `http://localhost:8000/docs` પર છે. |
| Final screen recording | User action pending | `docs/screen-recording-script.md` પ્રમાણે evaluator walkthrough record કરવો. |
| External cloud production deployment | Optional handoff step | CI image builds અને deployment guide છે; target provider credentials userની પાસે રહે છે. |
| `.env.example` filename | Platform constraint disclosed | તેના બદલે complete secret-free `environment.example` આપવામાં આવ્યું છે. |

> **મહત્વપૂર્ણ:** current validation reportમાં જે source ID દેખાય છે તે જ ID Episode library searchમાં નાખો. Pencil દ્વારા load કરેલી episode edit કરતાં તેની existing artwork declaration preserve થાય છે; repair કરતાં નવા avoidable artwork blocker ઊભા નહીં થાય.

## શરૂઆત કરતા પહેલાં

1. Docker Compose ચાલુ હોય તો browserમાં `http://localhost:3000/cms` ખોલો.
2. **Local admin sign in** કરો. Docker local modeનો password `peblo-local-admin` છે.
3. ઉપરના **Validation report**માં પ્રથમ issue અને તેની `ep_...` source ID નોંધો.
4. નીચેના **Episode library**ના search boxમાં તે exact source ID નાખો.
5. મળેલી rowમાં **pencil** icon દબાવો. આ action episode, તેની parent show, અને તેનું season editorમાં load કરે છે. હવે આ entryને delete કરવાને બદલે safely update કરી શકાય છે.

દરેક change પછી **Save show**, **Update episode**, અથવા artwork upload પૂર્ણ થવા દો. Validation report live re-compute થાય છે; જૂનો issue recordમાંથી બળજબરીથી delete કરવો પડતો નથી.

## Missing Artwork fix કરવાની રીત

`Missing Artwork`નો અર્થ છે કે તે episodeના show માટે valid **poster** અને **banner**, અને તે ચોક્કસ episode માટે valid **thumbnail** હોવો જોઈએ.

1. Affected `ep_...` શોધીને pencil દબાવો. Parent show હવે Show editorમાં selected રહેશે.
2. **Artwork slots**માં `Poster (selected show)` પસંદ કરો અને valid poster upload કરો, જો reportમાં તે show માટે poster missing હોય.
3. એ જ show માટે `Banner (selected show)` પસંદ કરીને valid banner upload કરો, જો તે missing હોય.
4. `Thumbnail (select episode)` પસંદ કરો.
5. દેખાતા dropdownમાંથી target `ep_... · episode title` પસંદ કરો. Numeric database ID લખવાની જરૂર નથી.
6. તે episode માટે thumbnail upload કરો અને upload success messageની રાહ જુઓ.
7. Reportમાં issue ઘટે છે કે નહીં તે confirm કરો. એક જ show માટે poster/banner એક વાર પૂરતા છે, પરંતુ દરેક affected episodeને પોતાની thumbnail જોઈએ.

| Artwork | CMS target | Shape | Recommended source size | Limit |
|---|---|---:|---:|---:|
| Poster | Selected show | 2:3 | 600×900 | 200 KB |
| Banner | Selected show | 16:9 | 1280×720 | 200 KB |
| Thumbnail | Explicit selected episode | 16:9 | 640×360 | 200 KB |

PNG અથવા JPEG જ વાપરો. File size 200 KBથી વધારે હશે તો upload reject થશે.

## Missing Section fix કરવાની રીત

Missing section issue episode પર દેખાય છે, પરંતુ correction તેના **parent show**માં થાય છે.

1. Reportનું affected episode pencilથી load કરો.
2. right-side **Show editor**માં show title અને fields loaded હોવાનું તપાસો.
3. `No section (draft only)` dropdownમાંથી યોગ્ય browse section પસંદ કરો, જેમ કે `Featured`, `Series`, `Minisodes`, અથવા `Songs`.
4. **Save show** દબાવો.
5. Report refresh થાય ત્યારબાદ તે show સાથે જોડાયેલા બધા missing-section issues દૂર થવા જોઈએ.

## Duplicate Content Group Language fix કરવાની રીત

એક જ `(content group, language)` pair બે episodes માટે હોવો ન જોઈએ.

1. Reportમાં દેખાતા duplicate source ID, ઉદાહરણ તરીકે `ep_9001`, Episode library searchમાં શોધો.
2. Pencil દબાવી episode editorમાં entry load કરો.
3. `Content group` અને `Language` fields તપાસો.
4. જો તે અલગ content છે, તો સાચો unique **content group** લખો. જો language variant છે, તો સાચી **language** પસંદ કરો.
5. **Update episode** દબાવો અને reportમાંથી duplicate issue દૂર થયો છે કે નહીં confirm કરો.

> એક જ titleના language variants માટે content group same રહી શકે છે, પરંતુ તેમની language અલગ હોવી જોઈએ. બે અલગ recordsમાં બન્ને values same ન હોઈ શકે.

## Missing Duration fix કરવાની રીત

1. Affected episode શોધો અને pencil દબાવો.
2. **Duration seconds** fieldમાં `0` કરતાં મોટું સાચું runtime નાખો.
3. **Update episode** દબાવો.
4. Validation reportમાં issue દૂર થયો છે કે નહીં તપાસો.

## New episode ઉમેરવાની સાચી રીત

નવી entry બનાવવા માટે show select કરો, પછી **Add season** કરીને જરૂર હોય તો season બનાવો. ત્યારબાદ episode editorમાં manual database season ID લખવાને બદલે **Choose season** dropdownમાંથી season પસંદ કરો. Source ID, episode number, title, content group, duration, language, અને status પૂરા કરીને **Save episode** દબાવો. અંતે thumbnail માટે Artwork slotsમાં એ નવી episode explicitly select કરો.

## Publish પહેલાં final checklist

| Check | Expected result |
|---|---|
| Validation report | `0` issues અને `Blocked` badge ગાયબ |
| Existing record edits | Pencilથી target episode load કરીને `Update episode` કરવામાં આવ્યું છે |
| Artwork | Required poster, banner, અને per-episode thumbnail accepted છે |
| Browse sections | દરેક publishable showને section છે |
| Content group/language | Duplicate pair નથી |
| Publish | **Publish catalogue**થી successful audit entry બને છે |

Validation count `0` થયા પછી જ **Publish catalogue** દબાવો. Publisher પહેલા versioned catalogue write કરે છે અને પછી active pointer switch કરે છે. Publish fail થાય તો અગાઉનો active catalogue જ viewerને serve થતો રહે છે.
