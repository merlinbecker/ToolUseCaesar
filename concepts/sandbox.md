# Konzept: Sichere JavaScript-Sandbox für Pre-/Post-Processing

**Datum:** 2026-01-09  
**Zweck:** Behebung des Sicherheitsproblems "Sandbox: Sichere Sandbox-Implementierung" aus `/reports/CodeScan.md`  
**Kontext:** Pre- und Post-Processing von Daten in ToolUseCaesar

---

## 1. Problemstellung

### 1.1 Aktueller Zustand

Die aktuelle Implementierung in `server/routes.ts` (Zeilen 18-67) verwendet eine **unsichere String-Replacement-basierte Sandbox**:

```typescript
const safeCode = code
  .replace(/require\s*\(/g, "/* disabled require */")
  .replace(/import\s+/g, "/* disabled import */")
  .replace(/process\./g, "/* disabled process */")
  .replace(/global\./g, "/* disabled global */")
  .replace(/eval\s*\(/g, "/* disabled eval */")
  .replace(/Function\s*\(/g, "/* disabled Function */");
```

### 1.2 Sicherheitsprobleme

Die aktuelle Implementierung hat mehrere kritische Schwachstellen:

1. **Umgehung durch Constructor-Chains:**
   ```javascript
   this.constructor.constructor('malicious code')()
   (()=>{}).__proto__.constructor('malicious code')()
   ```

2. **Template-String-Tricks:**
   ```javascript
   `${constructor.constructor('return process')()}`
   ```

3. **Prototype-Pollution:**
   - Zugriff auf `Object.prototype`, `Array.prototype` etc.
   - Manipulation globaler Prototypen

4. **Fehlender Timeout:**
   - Der `timeout`-Parameter wird nicht verwendet
   - DoS durch Endlosschleifen möglich

5. **Resource-Exhaustion:**
   - Keine Speicherbegrenzung
   - Keine CPU-Zeit-Begrenzung

### 1.3 Anforderungen an die Sandbox

Basierend auf der Aufgabenstellung und dem Anwendungsfall:

**Funktional:**
- ✅ Ausführung von JavaScript-Code für Datenverarbeitung
- ✅ Zugriff auf Input-Daten (JSON-serialisierbar)
- ✅ Rückgabe transformierter Daten
- ❌ **KEIN** Dateisystem-Zugriff
- ❌ **KEIN** Netzwerk-Zugriff (HTTP/fetch)
- ❌ **KEIN** Zugriff auf Node.js-Module

**Nicht-funktional:**
- 🔒 **Sicherheit:** Vollständige Isolation von Host-System
- ⏱️ **Timeout:** Konfigurierbare Ausführungszeitbegrenzung
- 💾 **Memory-Limits:** Schutz vor Speicher-Erschöpfung
- 🚀 **Performance:** Schnelle Ausführung für kleine Transformationen
- 📦 **Wartbarkeit:** Einfache Integration in bestehende Codebasis

---

## 2. Evaluierte Alternativen

### 2.1 Alternative 1: isolated-vm

**Beschreibung:**  
Node.js-Wrapper um V8 Isolates für echte Prozess-Isolation.

**Vorteile:**
- ✅ Starke Isolation durch separate V8-Isolates
- ✅ Timeout-Unterstützung
- ✅ Memory-Limits konfigurierbar
- ✅ Open Source, aktiv gepflegt (Maintenance-Mode)
- ✅ Keine externe Abhängigkeiten/Services
- ✅ Selbst-hostbar

**Nachteile:**
- ⚠️ Maintenance-Mode (keine neuen Features)
- ⚠️ Native Abhängigkeit (C++-Kompilierung erforderlich)
- ⚠️ Komplexere API
- ⚠️ Potenzielle Out-of-Memory-Probleme bei V8

**Beispiel-Code:**
```javascript
import ivm from 'isolated-vm';

const isolate = new ivm.Isolate({ memoryLimit: 8 }); // 8 MB
const context = await isolate.createContext();

const code = `
  function transform(data) {
    return { ...data, processed: true };
  }
  transform($0)
`;

const result = await context.eval(code, { 
  arguments: [{ copy: true, value: inputData }],
  timeout: 5000 // 5 Sekunden
});
```

**Kosten:** Kostenlos (Open Source)  
**Deployment-Komplexität:** Mittel (Build-Zeit für native Module)

---

### 2.2 Alternative 2: QuickJS (via @sebastianwessel/quickjs)

**Beschreibung:**  
WebAssembly-basierte JavaScript-Engine mit vollständiger Sandbox-Isolation.

**Vorteile:**
- ✅ Vollständige Isolation (WebAssembly-Sandbox)
- ✅ Timeout-Unterstützung
- ✅ Memory-Limits
- ✅ Keine native Kompilierung (Pure WebAssembly)
- ✅ Aktiv entwickelt
- ✅ Einfache API
- ✅ TypeScript-Support
- ✅ Sehr gute Performance für kleine Skripte

**Nachteile:**
- ⚠️ Kleinere Community als isolated-vm
- ⚠️ Nicht 100% ECMAScript-kompatibel (QuickJS-Engine)
- ⚠️ Overhead durch WASM-Grenze

**Beispiel-Code:**
```javascript
import { loadQuickJs, type SandboxOptions } from '@sebastianwessel/quickjs';

const { runSandboxed } = await loadQuickJs();

const options: SandboxOptions = {
  timeoutMs: 5000,
  memoryLimitMb: 8,
  allowFetch: false,
  allowFs: false
};

const code = `
  globalThis.inputData = ${JSON.stringify(inputData)};
  function transform(data) {
    return { ...data, processed: true };
  }
  transform(globalThis.inputData)
`;

const result = await runSandboxed(
  async ({ evalCode }) => evalCode(code),
  options
);
```

**Kosten:** Kostenlos (Open Source)  
**Deployment-Komplexität:** Niedrig (npm install)

---

### 2.3 Alternative 3: Riza (Cloud Service)

**Beschreibung:**  
Managed Cloud-Service für sichere Code-Ausführung via HTTP-API.

**Vorteile:**
- ✅ Maximale Sicherheit (externe Prozess-Isolation)
- ✅ Keine lokale Sandbox-Verwaltung
- ✅ Aktiv entwickelt und gewartet
- ✅ Support für mehrere Sprachen (JS/TS/Python/Ruby/PHP)
- ✅ Enterprise-Grade Security
- ✅ Professioneller Support

**Nachteile:**
- ❌ **Kostenpflichtig** (ab $20/Monat)
- ❌ Externe Abhängigkeit (Network-Call erforderlich)
- ❌ Latenz durch HTTP-Roundtrip
- ❌ Daten verlassen den Server (Privacy-Bedenken)
- ❌ Vendor-Lock-in

**Beispiel-Code:**
```javascript
import { Riza } from '@riza-io/api';

const riza = new Riza({ apiKey: process.env.RIZA_API_KEY });

const result = await riza.command.exec({
  language: 'JAVASCRIPT',
  code: `
    function transform(data) {
      return { ...data, processed: true };
    }
    console.log(JSON.stringify(transform(${JSON.stringify(inputData)})));
  `,
  timeout: 5000
});
```

**Kosten:** Ab $20/Monat (Pro-Plan)  
**Deployment-Komplexität:** Niedrig (API-Integration)

---

### 2.4 Alternative 4: Warnung + Dokumentation

**Beschreibung:**  
Beibehaltung der aktuellen Implementierung mit klarer Warnung für Nutzer.

**Vorteile:**
- ✅ Keine Code-Änderungen erforderlich
- ✅ Keine neuen Abhängigkeiten
- ✅ Sofort umsetzbar

**Nachteile:**
- ❌ **Sicherheitsrisiko bleibt bestehen**
- ❌ Benutzer müssen vorsichtig sein
- ❌ Verletzt Qualitätsziel "Sicherheit"
- ❌ Nicht für Multi-Tenant-Umgebungen geeignet

**Umsetzung:**
- Warnung in der UI (Tool-Editor)
- Dokumentation der Sicherheitsrisiken
- Hinweis: "Nur vertrauenswürdigen Code ausführen"
- Optional: Timeout-Implementierung hinzufügen

**Kosten:** Kostenlos  
**Deployment-Komplexität:** Minimal

---

## 3. Vergleichsmatrix

| Kriterium | isolated-vm | QuickJS | Riza | Warnung |
|-----------|-------------|---------|------|---------|
| **Sicherheit** | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐ |
| **Timeout-Support** | ✅ | ✅ | ✅ | ⚠️ (manuell) |
| **Memory-Limits** | ✅ | ✅ | ✅ | ❌ |
| **Performance** | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **Kosten** | Kostenlos | Kostenlos | $20+/Monat | Kostenlos |
| **Deployment** | Mittel | Einfach | Einfach | Trivial |
| **Wartung** | Maintenance | Aktiv | Aktiv | - |
| **Privacy** | ✅ | ✅ | ⚠️ (Cloud) | ✅ |
| **Latenz** | ~1-5ms | ~1-5ms | ~50-200ms | <1ms |
| **Offline-fähig** | ✅ | ✅ | ❌ | ✅ |
| **ECMAScript-Kompatibilität** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |

---

## 4. Empfohlene Lösung: QuickJS

### 4.1 Begründung

Nach Abwägung aller Faktoren empfehle ich **QuickJS (via @sebastianwessel/quickjs)** als optimale Lösung:

**Hauptgründe:**

1. **Sicherheit:** Vollständige WebAssembly-Isolation ohne bekannte Escape-Möglichkeiten
2. **Einfachheit:** Keine native Kompilierung, einfaches `npm install`
3. **Aktive Entwicklung:** Regelmäßige Updates und Bug-Fixes
4. **Performance:** Sehr gut für den Anwendungsfall (kleine Transformationen)
5. **Privacy:** Daten bleiben auf dem Server
6. **Kostenlos:** Keine laufenden Kosten
7. **Timeout + Memory-Limits:** Out-of-the-box

**Warum nicht isolated-vm?**
- Maintenance-Mode → unsichere Zukunft
- Native Abhängigkeit → Deployment-Komplexität
- QuickJS bietet gleiche/bessere Sicherheit

**Warum nicht Riza?**
- Kosten ($20+/Monat)
- Privacy-Bedenken (Daten verlassen Server)
- Netzwerk-Latenz
- Vendor-Lock-in

**Warum nicht nur Warnung?**
- Verletzt Qualitätsziel "Sicherheit"
- Nicht verantwortbar für Multi-Tenant-Einsatz

---

## 5. Implementierungsplan

### 5.1 Phase 1: Dependency-Installation

**Aufwand:** 5 Minuten

```bash
npm install @sebastianwessel/quickjs
```

**Änderungen:**
- `package.json`: Neue Dependency

---

### 5.2 Phase 2: Sandbox-Modul erstellen

**Aufwand:** 2-3 Stunden

**Datei:** `server/sandbox.ts` (neu)

**Wichtiger Hinweis:**  
Der folgende Code basiert auf der dokumentierten API von `@sebastianwessel/quickjs` (Stand Januar 2026). Bei der tatsächlichen Implementierung **muss die genaue API-Struktur** gegen die aktuelle Bibliotheksversion verifiziert werden. Insbesondere:
- Die Struktur des Return-Objekts (`result.ok`, `result.data`, `result.error`)
- Verfügbare Optionen in `SandboxOptions`
- Fehlerbehandlung und Exception-Types

Falls die API abweicht, muss der Code entsprechend angepasst werden. Der Kern-Ansatz (WebAssembly-Isolation mit Timeout und Memory-Limits) bleibt jedoch gleich.

```typescript
import { loadQuickJs, type SandboxOptions } from '@sebastianwessel/quickjs';

let runSandboxed: Awaited<ReturnType<typeof loadQuickJs>>['runSandboxed'] | null = null;

/**
 * Initialisiert die QuickJS-Runtime (einmalig beim Server-Start)
 */
export async function initializeSandbox() {
  if (!runSandboxed) {
    try {
      const quickJs = await loadQuickJs();
      runSandboxed = quickJs.runSandboxed;
      console.log('QuickJS sandbox initialized');
    } catch (error) {
      console.error('Failed to initialize QuickJS sandbox:', error);
      throw new Error('Sandbox initialization failed. Server cannot start without sandbox support.');
    }
  }
}

/**
 * Führt JavaScript-Code in einer sicheren Sandbox aus
 */
export async function executeSandboxedCode(
  code: string,
  inputName: string,
  input: unknown,
  contextName: string,
  timeout: number = 5000
): Promise<unknown> {
  if (!code || code.trim() === "") return input;
  
  if (!runSandboxed) {
    throw new Error('Sandbox not initialized. Call initializeSandbox() first.');
  }
  
  try {
    // Prüfen ob Legacy-Format (function preprocess/postprocess)
    const expectedFnName = contextName === "preprocess" ? "preprocess" : "postprocess";
    const isLegacyFormat = new RegExp(`function\\s+${expectedFnName}\\s*\\(`).test(code);
    
    let executableCode: string;
    if (isLegacyFormat) {
      executableCode = `
        ${code}
        ${expectedFnName}(input);
      `;
    } else {
      executableCode = code;
    }
    
    // Sicherer Datenübergabe-Mechanismus
    // WICHTIG: Bei der Implementierung die tatsächliche API verifizieren!
    // Alternative Ansätze falls globalThis nicht funktioniert:
    // 1. Parameterübergabe über Function-Arguments (falls unterstützt)
    // 2. Escaped JSON-String mit korrektem Escaping aller Sonderzeichen
    // 3. Base64-Encoding des JSON-Strings
    
    const wrappedCode = `
      globalThis.input = ${JSON.stringify(input)};
      globalThis.${inputName} = globalThis.input;
      
      ${executableCode}
    `;
    
    const options: SandboxOptions = {
      timeoutMs: timeout,
      memoryLimitMb: 8, // 8 MB Memory-Limit
      allowFetch: false,
      allowFs: false
    };
    
    const result = await runSandboxed(
      async ({ evalCode }) => evalCode(wrappedCode),
      options
    );
    
    // Erfolgreiches Result
    if (result.ok) {
      return result.data !== undefined ? result.data : input;
    } else {
      // Fehlerbehandlung
      console.error(`${contextName} execution error:`, result.error);
      
      // Bei Timeout-Fehler spezifische Meldung
      if (result.error.name === 'TimeoutError' || result.error.message?.includes('timeout')) {
        throw new Error(`${contextName} execution timeout after ${timeout}ms`);
      }
      
      // Bei anderen Fehlern: Original-Input zurückgeben
      return input;
    }
  } catch (error) {
    console.error(`${contextName} execution error:`, error);
    // Bei kritischen Fehlern (z.B. Timeout): Input zurückgeben
    return input;
  }
}

/**
 * Cleanup-Funktion (optional, beim Server-Shutdown)
 */
export async function shutdownSandbox() {
  runSandboxed = null;
  console.log('QuickJS sandbox shutdown');
}
```

**Hinweis zur Datenübergabe:**
Die Implementierung verwendet `globalThis` zur Datenübergabe in die Sandbox. Der Input wird als JSON serialisiert und in der isolierten Umgebung als globale Variable verfügbar gemacht. Da der Code in einer vollständig isolierten WebAssembly-Umgebung läuft, sind JSON-Injection-Angriffe auf den Host-Prozess nicht möglich - die Sandbox kann nur ihre eigene isolierte Umgebung manipulieren.

**Sicherheitshinweise:**
- `allowFetch: false` verhindert HTTP-Requests
- `allowFs: false` verhindert Dateisystem-Zugriffe
- `timeoutMs` verhindert Endlosschleifen
- `memoryLimitMb` verhindert Memory-Exhaustion

**Tests:**
- Unit-Tests für verschiedene Code-Patterns
- Timeout-Tests
- Memory-Limit-Tests
- Error-Handling-Tests
- **Sicherheitstests:** JSON-Injection-Versuche mit Sonderzeichen

---

### 5.3 Phase 3: Integration in routes.ts

**Aufwand:** 1 Stunde

**Änderungen in `server/routes.ts`:**

1. **Alte Funktion entfernen:**
   - Zeilen 18-67 löschen

2. **Import hinzufügen:**
   ```typescript
   import { executeSandboxedCode } from './sandbox.js';
   ```

3. **Funktion wird automatisch verwendet** (bereits im Code aufgerufen)

**Änderungen in `server/index.ts`:**

```typescript
import { initializeSandbox } from './sandbox.js';

// ... existing code ...

async function startServer() {
  // Sandbox initialisieren
  await initializeSandbox();
  
  // ... rest of server startup ...
}

startServer();
```

---

### 5.4 Phase 4: UI-Warnung hinzufügen (optional)

**Aufwand:** 1 Stunde

**Datei:** `client/src/pages/tool-editor.tsx`

Warnung im Pre-/Post-Processing-Editor:

```typescript
<div className="mb-2 p-3 bg-blue-50 border border-blue-200 rounded">
  <p className="text-sm text-blue-800">
    ℹ️ Code wird in einer sicheren Sandbox ausgeführt. 
    Maximale Ausführungszeit: 5 Sekunden. 
    Kein Zugriff auf Dateisystem oder Netzwerk.
  </p>
</div>
```

---

### 5.5 Phase 5: Dokumentation

**Aufwand:** 1-2 Stunden

**Dateien zu aktualisieren:**

1. **`replit.md`:**
   - Sandbox-Sicherheitsfeatures dokumentieren
   - Limits dokumentieren (Timeout, Memory)

2. **`arc42/01_introduction_and_goals.md`:**
   - Qualitätsziel "Sicherheit" als erfüllt markieren

3. **Neue Datei `docs/pre-post-processing.md`:**
   - Erklärung der Pre-/Post-Processing-Funktion
   - Sandbox-Einschränkungen
   - Code-Beispiele
   - Best Practices

---

### 5.6 Phase 6: Testing & Validation

**Aufwand:** 2-3 Stunden

**Test-Szenarien:**

1. **Funktionale Tests:**
   - Einfache Transformation: `return { ...input, modified: true }`
   - JSONPath-ähnliche Zugriffe
   - Array-Operationen (map, filter, reduce)
   - Legacy-Format (function preprocess/postprocess)

2. **Sicherheits-Tests:**
   - Constructor-Chain-Angriff: `this.constructor.constructor('...')`
   - Prototype-Pollution: `Object.prototype.polluted = true`
   - Versuch auf `process` zuzugreifen
   - Versuch auf `require` zuzugreifen

3. **Performance-Tests:**
   - Timeout-Test: Endlosschleife `while(true){}`
   - Memory-Test: Großes Array erstellen
   - Normale Transformationen: <10ms

4. **Error-Handling-Tests:**
   - Syntax-Fehler im Code
   - Runtime-Fehler (undefined access)
   - Timeout-Überschreitung

---

## 6. Risiken und Mitigationen

### 6.1 Risiko: QuickJS-Bug/Vulnerability

**Wahrscheinlichkeit:** Niedrig  
**Impact:** Hoch

**Mitigation:**
- Regelmäßige Updates von `@sebastianwessel/quickjs`
- Dependabot/Renovate für automatische Update-PRs
- Security-Monitoring (GitHub Security Advisories)

### 6.2 Risiko: Performance-Probleme

**Wahrscheinlichkeit:** Niedrig  
**Impact:** Mittel

**Mitigation:**
- Timeout sicherstellt keine Blockierung
- Memory-Limit verhindert Überlastung
- Monitoring der Ausführungszeiten
- Bei Bedarf: Caching von kompilierten Funktionen

### 6.3 Risiko: ECMAScript-Inkompatibilität

**Wahrscheinlichkeit:** Niedrig-Mittel  
**Impact:** Niedrig

**Mitigation:**
- Dokumentation der unterstützten Features
- Hinweis auf moderne ES6+-Features
- Fallback-Dokumentation für unsupported Features

---

## 7. Migration bestehender Tools

### 7.1 Backward-Compatibility

Die neue Implementierung ist **100% abwärtskompatibel**:

- ✅ Legacy-Format (`function preprocess(input) {...}`) wird erkannt
- ✅ Modernes Format (direkter Code) funktioniert
- ✅ Gleiches Input/Output-Interface
- ✅ Gleiche Fehlerbehandlung (Fallback auf Original-Input)

### 7.2 Migration bestehender Daten

**Keine Migration erforderlich:**
- Tools bleiben unverändert in der Datenbank
- Code wird zur Laufzeit in der neuen Sandbox ausgeführt

---

## 8. Langfristige Betrachtung

### 8.1 Alternative Entwicklung

Falls QuickJS nicht mehr gewartet wird:

**Option 1:** Migration zu isolated-vm (wenn wieder aktiv entwickelt)  
**Option 2:** Migration zu nachfolgendem oder ähnlichem Projekt  
**Option 3:** Eigenentwicklung WASM-Sandbox

**Aufwand:** 1-2 Tage (Interface bleibt gleich)

### 8.2 Erweiterungsmöglichkeiten

**Zukünftige Features:**

1. **Custom Libraries:**
   - Lodash, date-fns etc. in Sandbox verfügbar machen
   - Konfigurierbar pro Tool

2. **Debugging-Modus:**
   - Console.log-Output in UI anzeigen
   - Step-by-Step-Debugging

3. **Code-Templates:**
   - Vorgefertigte Transformationen
   - Snippet-Library

4. **Performance-Monitoring:**
   - Ausführungszeiten tracken
   - Slow-Query-Detection

---

## 9. Kosten-Nutzen-Analyse

### 9.1 Einmalige Kosten

| Aktivität | Aufwand | Kosten (bei 80€/h) |
|-----------|---------|-------------------|
| Dependency-Installation | 0.1h | 8€ |
| Sandbox-Modul | 2.5h | 200€ |
| Integration | 1h | 80€ |
| UI-Warnung | 1h | 80€ |
| Dokumentation | 1.5h | 120€ |
| Testing | 2.5h | 200€ |
| **Gesamt** | **8.6h** | **688€** |

### 9.2 Laufende Kosten

- **QuickJS:** 0€/Monat (Open Source)
- **Wartung:** ~1h/Quartal = ~80€/Jahr

### 9.3 Nutzen

**Quantifizierbar:**
- ✅ Keine Sicherheitsvorfälle durch Code-Injection
- ✅ Keine DoS durch Endlosschleifen
- ✅ Erfüllung Qualitätsziel "Sicherheit"

**Nicht-quantifizierbar:**
- ✅ Vertrauen der Nutzer
- ✅ Professionelles Image
- ✅ Multi-Tenant-fähig
- ✅ Compliance-konform

**ROI:**  
Bei nur einem verhinderten Sicherheitsvorfall (Cleanup-Kosten >>688€) ist die Investition rentabel.

---

## 10. Entscheidung

### ✅ Empfehlung: QuickJS implementieren

**Nächste Schritte:**

1. ✅ Freigabe dieses Konzepts
2. ⏳ Implementierung gemäß Phase 1-6
3. ⏳ Code-Review
4. ⏳ Deployment in Staging
5. ⏳ Testing in Staging
6. ⏳ Deployment in Production

**Zeitplan:**
- Start: Nach Freigabe
- Fertigstellung: ~2 Arbeitstage
- Go-Live: Nach erfolgreichem Staging-Test

**Wichtiger Implementierungshinweis:**
Vor Beginn der Implementierung muss die aktuelle API-Dokumentation von `@sebastianwessel/quickjs` konsultiert werden. Die in diesem Konzept gezeigten Code-Beispiele basieren auf der dokumentierten API (Stand Januar 2026), aber Library-Updates können API-Änderungen mit sich bringen. Insbesondere sollten geprüft werden:
- Die genaue Signatur von `loadQuickJs()` und `runSandboxed()`
- Die Struktur der Rückgabewerte (`result.ok`, `result.data`, `result.error`)
- Verfügbare Konfigurationsoptionen in `SandboxOptions`
- Alternative Mechanismen zur Datenübergabe in die Sandbox

---

## 11. Referenzen

1. **CodeScan-Report:** `/reports/CodeScan.md`
2. **QuickJS-Wrapper:** https://github.com/sebastianwessel/quickjs
3. **QuickJS npm Dokumentation:** https://www.npmjs.com/package/@sebastianwessel/quickjs
4. **isolated-vm:** https://github.com/laverdet/isolated-vm
5. **Riza:** https://riza.io/
6. **vm2 Security Advisory:** https://github.com/patriksimek/vm2/security/advisories
7. **JavaScript Sandbox Best Practices:** https://dev.to/leapcell/a-deep-dive-into-javascript-sandboxing-97b

---

## Anhang A: Sicherheitsvergleich

### Aktuelle Implementierung (String-Replacement)

```javascript
// Umgehbar durch:
this.constructor.constructor('return process')()
(()=>{}).__proto__.constructor('malicious code')()
Object.getPrototypeOf(async function(){}).constructor('code')()
```

### QuickJS Sandbox

```javascript
// Alle Zugriffe werden blockiert:
this.constructor.constructor // undefined in WASM
process // undefined
require // undefined
fetch // undefined (konfiguriert)
```

**Ergebnis:** QuickJS bietet echte Isolation ohne bekannte Escape-Methoden.

---

## Anhang B: Performance-Benchmark (geschätzt)

| Szenario | Aktuelle Impl. | QuickJS | Overhead |
|----------|---------------|---------|----------|
| Einfache Transformation | <1ms | ~2-3ms | +2ms |
| Komplexe Transformation | ~5ms | ~7-10ms | +2-5ms |
| JSONPath-Mapping | ~2ms | ~4-5ms | +2-3ms |
| Timeout (Endlosschleife) | ∞ (blockiert) | 5000ms (konfiguriert) | N/A |

**Fazit:** Minimaler Overhead bei maximaler Sicherheit.

---

**Ende des Konzeptdokuments**
