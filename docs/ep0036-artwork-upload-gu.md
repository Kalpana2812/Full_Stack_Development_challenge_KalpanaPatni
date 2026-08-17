# ep_0036 Artwork Upload માર્ગદર્શિકા

આ ત્રણ images ખાસ **`ep_0036` — Discover India with Moti / The Midnight Market** માટે તૈયાર કરેલી છે. દરેક JPEG છે, CMS માટે યોગ્ય exact dimensions ધરાવે છે અને 200 KBથી નાની છે. આ images માત્ર validation error દૂર કરવા માટે નહીં, પરંતુ viewer UIમાં પણ artwork તરીકે દેખાશે.

| File | CMS Artwork type | Verified dimensions | File size |
| --- | --- | ---: | ---: |
| `ep_0036-poster.jpg` | Poster | 600 × 900 px | 123,359 bytes |
| `ep_0036-banner.jpg` | Banner | 1280 × 720 px | 123,564 bytes |
| `ep_0036-thumbnail.jpg` | Thumbnail | 640 × 360 px | 76,128 bytes |

## Upload steps

1. Browserમાં `http://localhost:3000` ખોલો અને **Studio / CMS** પર જાઓ. જરૂર હોય તો local admin password `peblo-local-admin` વડે sign in કરો.
2. **Episode Library**માં `ep_0036` શોધો. તેના rowમાં આવેલ pencil/edit icon પસંદ કરો.
3. Artwork areaમાં **Poster** પસંદ કરી `ep_0036-poster.jpg` upload કરો.
4. Artwork typeને **Banner** બદલો અને `ep_0036-banner.jpg` upload કરો.
5. Artwork typeને **Thumbnail** બદલો. Episode target dropdownમાં સ્પષ્ટ રીતે **`ep_0036 — The Midnight Market`** પસંદ કરો અને `ep_0036-thumbnail.jpg` upload કરો.
6. દરેક artwork upload થયા પછી editorનું **Save** button દબાવો.
7. **Validation Report** refresh કરો. `ep_0036 Missing Artwork (Poster + Banner + Thumbnail)` blocker અદૃશ્ય થવો જોઈએ.
8. કોઈ red publish blocker બાકી ન હોય તો **Publish catalogue** button દબાવો અને completed publish confirmation આવવા દો.

> `ep_9001`નું blue **Skipped import warning** audit warning છે, publish blocker નથી. તેને fix કરવાની જરૂર નથી.

## જો CMS હજુ પણ error બતાવે

ખાતરી કરો કે Thumbnail upload વખતે episode target તરીકે `ep_0036` જ પસંદ થયેલું હતું. ત્યારબાદ browser refresh કરીને Validation Report ફરી ખોલો. જો error હજી રહે તો artwork upload કર્યા પછી editorનું Save button દબાયું છે કે નહીં તે તપાસો.
