# SynTrade – AI Trading Assistant

> **⚠️ Disclaimer: Nie je finančné poradenstvo. Obchodujte na vlastné riziko.**

## Prehľad projektu

SynTrade je PWA aplikácia (Progressive Web App) pre sledovanie až 6 aktív (akcie, ETF, komodity, krypto) s AI signálmi BUY/HOLD/SELL a push notifikáciami.

---

## Štruktúra súborov

```
syntrade/
├── index.html                          # Hlavná HTML stránka
├── styles.css                          # Dizajn (dark terminal)
├── app.js                              # Frontend logika
├── manifest.json                       # PWA manifest
├── service-worker.js                   # SW: cache + push
├── netlify.toml                        # Netlify konfigurácia
├── icons/
│   ├── icon-192.png
│   └── icon-512.png
└── netlify/functions/
    ├── market-snapshot.js              # Ceny + RSI/SMA/momentum
    ├── news-sentiment.js               # GDELT správy + AI sentiment
    ├── macro.js                        # FRED makro dáta
    ├── sec-edgar.js                    # Insider transakcie (Form 4)
    ├── google-trends.js                # Google Trends (simulácia/SerpAPI)
    ├── monitor.js                      # Scheduled: každých 15 min
    ├── send-push.js                    # OneSignal push
    └── shared/
        └── signal.js                   # Výpočet signálu (zdieľaný)
```

---

## KROK 1: Nahraj projekt na GitHub

### 1a. Inštaluj Git (ak nemáš)
- Windows: https://git-scm.com/download/win
- Mac: `brew install git`

### 1b. Vytvor GitHub repozitár
1. Choď na https://github.com/new
2. Názov repozitára: `syntrade`
3. Nechaj ho **Public** (alebo Private – oboje funguje s Netlify)
4. **NEKLIKAJ** "Add README" – nechaj prázdny
5. Klikni **Create repository**

### 1c. Nahraj súbory
Otvor terminál (Command Prompt / PowerShell / Terminal) v priečinku kde máš súbory SynTrade:

```bash
cd cesta/k/syntrade

# Inicializuj Git repozitár
git init

# Pridaj všetky súbory
git add .

# Prvý commit
git commit -m "Initial SynTrade PWA"

# Pripoj GitHub repozitár (URL skopíruj z GitHub po vytvorení repozitára)
git remote add origin https://github.com/TVOJE_MENO/syntrade.git

# Nahraj
git push -u origin main
```

---

## KROK 2: Deploy na Netlify

### 2a. Vytvor Netlify účet
1. Choď na https://netlify.com
2. Klikni **Sign Up** → **Sign up with GitHub**
3. Potvrď prístup

### 2b. Nový projekt
1. Klikni **Add new site** → **Import an existing project**
2. Vyber **GitHub**
3. Povolí prístup ku GitHub → nájdi repozitár `syntrade`
4. Klikni na repozitár

### 2c. Build nastavenia
```
Base directory:   (nechaj prázdne)
Build command:    echo 'No build needed'
Publish directory: .
Functions directory: netlify/functions
```

5. Klikni **Deploy site**

Netlify automaticky detekuje `netlify.toml` a nastaví vše.

### 2d. Vlastná doména (voliteľné)
- V Netlify: **Domain management** → **Add custom domain**

---

## KROK 3: Environment Variables

V Netlify: **Site settings** → **Environment variables** → **Add variable**

### Povinné (základné fungovanie bez nich funguje v DEMO móde):

| Variable | Hodnota | Popis |
|----------|---------|-------|
| `URL` | `https://tvojastranka.netlify.app` | URL tvojej Netlify stránky |

### Odporúčané (pre reálne dáta):

| Variable | Kde získaš | Popis |
|----------|-----------|-------|
| `ONESIGNAL_APP_ID` | OneSignal Dashboard | Pre push notifikácie |
| `ONESIGNAL_REST_API_KEY` | OneSignal Dashboard | REST API kľúč |

### Voliteľné (pre lepšie dáta):

| Variable | Kde získaš | Popis |
|----------|-----------|-------|
| `POLYGON_API_KEY` | polygon.io/dashboard | Lepšie trhové dáta |
| `FRED_API_KEY` | fred.stlouisfed.org/docs/api/api_key.html | Makro dáta (ZADARMO) |
| `OPENAI_API_KEY` | platform.openai.com/api-keys | AI sentiment analýza |
| `SERPAPI_KEY` | serpapi.com | Reálne Google Trends |
| `DEFAULT_SYMBOLS` | `AAPL,NVDA,TSLA,BTC-USD,GC=F,CL=F` | Symboly pre monitor |
| `DEFAULT_THRESHOLD` | `85` | Min. confidence pre alert |
| `DEFAULT_ALERT_TYPES` | `BUY,SELL` | Typy alertov |

---

## KROK 4: Nastavenie OneSignal

OneSignal je **zadarmo** pre webové push notifikácie.

### 4a. Vytvor OneSignal účet
1. Choď na https://onesignal.com
2. **Sign Up** (zadarmo)
3. Klikni **New App/Website**

### 4b. Konfigurácia
1. Názov: `SynTrade`
2. Platform: **Web Push**
3. Website URL: `https://tvojastranka.netlify.app`
4. My site is not fully HTTPS: **NIE** (Netlify má HTTPS)
5. Klikni **Save & Continue**

### 4c. Získaj kľúče
Po vytvorení v Settings → Keys & IDs:
- **App ID** (napr. `abc12345-...`) → do `ONESIGNAL_APP_ID`
- **REST API Key** → do `ONESIGNAL_REST_API_KEY`

### 4d. Stiahni SDK súbory
OneSignal vyžaduje 2 súbory v root priečinku:
1. V OneSignal Dashboard: **Download OneSignal SDK files**
2. Stiahni `OneSignalSDKWorker.js`
3. Vlož ho do root priečinka (vedľa `index.html`)
4. Nahraj na GitHub a re-deploy

### 4e. Zadaj App ID v aplikácii
- Otvor SynTrade → Nastavenia (ozubené koliesko)
- Vlož tvoj OneSignal App ID
- Klikni Uložiť

---

## KROK 5: Testovanie push notifikácií

### Metóda 1: OneSignal Dashboard (najjednoduchšie)
1. Choď na https://app.onesignal.com
2. Vyber tvoju appku
3. **Messages** → **New Push**
4. Title: `📈 SynTrade Test`
5. Message: `AAPL BUY – 87% istota`
6. **Send to All Subscribers** → **Review and Send**

### Metóda 2: Cez Netlify Function
```bash
curl -X POST https://tvojastranka.netlify.app/.netlify/functions/send-push \
  -H "Content-Type: application/json" \
  -d '{"symbol":"AAPL","action":"BUY","confidence":88,"reasons":["RSI zdravá zóna","Cena nad SMA20"]}'
```

### Metóda 3: Browser DevTools
1. Otvor SynTrade v Chrome
2. F12 → Console
3. Vlož:
```javascript
new Notification('📈 SynTrade Test', { body: 'AAPL BUY – 88% istota', icon: '/icons/icon-192.png' })
```

### Testovanie scheduled function (monitor.js)
V Netlify: **Functions** → **monitor** → **Test function**

---

## KROK 6: Inštalácia ako PWA

### Na mobile (Android / iOS):
1. Otvor stránku v Chrome / Safari
2. Klikni na **⋮** (Chrome) alebo **Zdieľať** (Safari)
3. **Add to Home Screen** / **Pridať na domovskú obrazovku**
4. Aplikácia sa nainštaluje ako natívna app

### Na desktop (Chrome / Edge):
1. Klikni na ikonu **+** v adresnom riadku
2. **Install SynTrade**

---

## KROK 7: Aktualizácia

Po zmene kódu:
```bash
git add .
git commit -m "Update: popis zmeny"
git push
```
Netlify automaticky re-deployuje do ~1 minúty.

---

## Troubleshooting

### Push notifikácie nefungujú
- Skontroluj, či máš HTTPS (Netlify automaticky)
- Skontroluj `ONESIGNAL_APP_ID` v Nastaveniach aj v env vars
- Skontroluj, či browser dovolil notifikácie (Settings → Privacy → Notifications)

### Dáta sa nenačítajú
- Skontroluj Netlify Functions Logs: **Functions** → **market-snapshot** → **Logs**
- Yahoo Finance môže blokovať – počkaj chvíľu a skús znova
- Pridaj `POLYGON_API_KEY` pre spoľahlivejší zdroj

### CORS chyba v konzole
- Skontroluj `netlify.toml` – hlavičky CORS sú tam nastavené
- Redeployni projekt

### Service Worker sa neaktualizuje
- Chrome DevTools → Application → Service Workers → **Update on reload**

---

## Bezpečnosť

- **Nikdy** neukladaj API kľúče priamo do kódu
- Vždy použi **Netlify Environment Variables**
- `netlify.toml` neobsahuje žiadne citlivé dáta

---

## Zdroje dát a ich limity

| Zdroj | Typ | Limit zadarmo |
|-------|-----|---------------|
| Yahoo Finance | Ceny, OHLCV | Neobmedzený (neoficiálny) |
| GDELT | Správy, sentiment | Neobmedzený |
| SEC EDGAR | Insider, fundamenty | Neobmedzený |
| FRED | Makro dáta | 120 req/min (s API kľúčom) |
| Polygon.io | Ceny (kvalitné) | 5 req/min (free tier) |
| OpenAI | AI sentiment | Platené (za tokeny) |
| SerpAPI | Google Trends | 100 req/mesiac zadarmo |
| OneSignal | Push notifikácie | 10 000 subscribers zadarmo |

---

*SynTrade verzia 1.0 | Nie je finančné poradenstvo.*
