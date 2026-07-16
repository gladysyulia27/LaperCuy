#include <Arduino.h>
#include <WiFi.h>
#include <WiFiManager.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <ArduinoJson.h>
#include "config.h"
#include "secrets.h"

LiquidCrystal_I2C lcd(LCD_ADDRESS, LCD_COLS, LCD_ROWS);

struct ReadyOrder {
  int id;
  String code;
};

ReadyOrder readyOrders[12];
int readyCount = 0;
int readyIndex = 0;
int seenReadyIds[24];
int seenCount = 0;

unsigned long lastPoll = 0;
unsigned long codeShownAt = 0;
bool requestInFlight = false;
String visibleCode = "";
String pendingRequestId = "";
volatile bool issueButtonFlag = false;
volatile bool prevButtonFlag = false;
volatile bool nextButtonFlag = false;
volatile uint32_t lastIssueButtonUs = 0;
volatile uint32_t lastPrevButtonUs = 0;
volatile uint32_t lastNextButtonUs = 0;

void showLines(const String &a, const String &b) {
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print(a.substring(0, 16));
  lcd.setCursor(0, 1);
  lcd.print(b.substring(0, 16));
}

void IRAM_ATTR onIssueButton() {
  uint32_t now = micros();
  if (now - lastIssueButtonUs > 120000) {
    issueButtonFlag = true;
    lastIssueButtonUs = now;
  }
}

void IRAM_ATTR onPrevButton() {
  uint32_t now = micros();
  if (now - lastPrevButtonUs > 120000) {
    prevButtonFlag = true;
    lastPrevButtonUs = now;
  }
}

void IRAM_ATTR onNextButton() {
  uint32_t now = micros();
  if (now - lastNextButtonUs > 120000) {
    nextButtonFlag = true;
    lastNextButtonUs = now;
  }
}

bool consumeButton(volatile bool &flag) {
  noInterrupts();
  bool value = flag;
  flag = false;
  interrupts();
  return value;
}

String requestId() {
  return String(DEVICE_ID) + "-" + String(millis()) + "-" + String((uint32_t)esp_random(), HEX);
}

bool isSeen(int id) {
  for (int i = 0; i < seenCount; i++) if (seenReadyIds[i] == id) return true;
  return false;
}

void markSeen(int id) {
  if (isSeen(id)) return;
  if (seenCount < 24) seenReadyIds[seenCount++] = id;
}

void beepReady() {
  if (!BUZZER_ENABLED) return;
  digitalWrite(PIN_BUZZER, HIGH);
  delay(120);
  digitalWrite(PIN_BUZZER, LOW);
  delay(100);
  digitalWrite(PIN_BUZZER, HIGH);
  delay(120);
  digitalWrite(PIN_BUZZER, LOW);
}

void configureHttp(HTTPClient &http, const String &path, WiFiClientSecure &secure, WiFiClient &plain) {
  String base = String(API_BASE_URL);
  if (base.startsWith("https://")) {
    secure.setInsecure();
    http.begin(secure, base + path);
  } else {
    http.begin(plain, base + path);
  }
  http.setTimeout(HTTP_TIMEOUT_MS);
  http.addHeader("X-Device-Key", DEVICE_API_KEY);
  http.addHeader("X-Device-ID", DEVICE_ID);
}

void connectWifi() {
  WiFiManager wm;
  wm.setConnectTimeout(20);
  wm.setConfigPortalBlocking(true);

  if (digitalRead(PIN_PREV_BUTTON) == LOW && digitalRead(PIN_NEXT_BUTTON) == LOW) {
    showLines("RESET WIFI", "TAHAN...");
    delay(2000);
    if (digitalRead(PIN_PREV_BUTTON) == LOW && digitalRead(PIN_NEXT_BUTTON) == LOW) {
      wm.resetSettings();
      showLines("WIFI DIHAPUS", "SETUP ULANG");
      delay(1200);
    }
  }

  showLines("SETUP WIFI", "DelQueue-Setup");
  if (!wm.autoConnect("DelQueue-Setup")) {
    showLines("WIFI GAGAL", "RESTART");
    delay(1500);
    ESP.restart();
  }

  showLines("WIFI OK", WiFi.localIP().toString());
  delay(1000);
  configTime(0, 0, "pool.ntp.org", "time.google.com");
}

void heartbeat() {
  WiFiClientSecure secure;
  WiFiClient plain;
  HTTPClient http;
  configureHttp(http, "/api/device/heartbeat", secure, plain);
  http.addHeader("Content-Type", "application/json");
  StaticJsonDocument<192> doc;
  doc["deviceId"] = DEVICE_ID;
  doc["firmwareVersion"] = "1.0.0";
  doc["wifiRssi"] = WiFi.RSSI();
  doc["ip"] = WiFi.localIP().toString();
  String body;
  serializeJson(doc, body);
  http.POST(body);
  http.end();
}

void createCode() {
  if (requestInFlight) return;
  requestInFlight = true;
  if (pendingRequestId == "") pendingRequestId = requestId();
  showLines("MEMBUAT KODE...", "MOHON TUNGGU");

  WiFiClientSecure secure;
  WiFiClient plain;
  HTTPClient http;
  configureHttp(http, "/api/device/sessions", secure, plain);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-Request-ID", pendingRequestId);
  int status = http.POST("{\"firmwareVersion\":\"1.0.0\"}");
  if (status >= 200 && status < 300) {
    StaticJsonDocument<512> doc;
    deserializeJson(doc, http.getString());
    visibleCode = doc["code"].as<String>();
    codeShownAt = millis();
    pendingRequestId = "";
    showLines("KODE PESANAN", visibleCode);
  } else {
    showLines("SERVER OFFLINE", "COBA LAGI");
  }
  http.end();
  requestInFlight = false;
}

void pollDisplay() {
  if (millis() - lastPoll < DISPLAY_POLL_MS) return;
  lastPoll = millis();
  if (WiFi.status() != WL_CONNECTED) {
    showLines("WIFI TERPUTUS", "MENGHUBUNGKAN");
    WiFi.reconnect();
    return;
  }

  WiFiClientSecure secure;
  WiFiClient plain;
  HTTPClient http;
  configureHttp(http, "/api/device/display-state", secure, plain);
  int status = http.GET();
  if (status < 200 || status >= 300) {
    showLines("SERVER OFFLINE", "TUNGGU");
    http.end();
    return;
  }

  StaticJsonDocument<2048> doc;
  deserializeJson(doc, http.getString());
  http.end();

  readyCount = 0;
  JsonArray arr = doc["readyOrders"].as<JsonArray>();
  for (JsonObject item : arr) {
    if (readyCount >= 12) break;
    int id = item["id"].as<int>();
    readyOrders[readyCount++] = {id, item["code"].as<String>()};
    if (!isSeen(id)) {
      markSeen(id);
      beepReady();
      readyIndex = readyCount - 1;
    }
  }

  if (!doc["ordersOpen"].as<bool>()) {
    showLines("ANTREAN TUTUP", "COBA NANTI");
  } else if (readyCount > 0) {
    if (readyIndex >= readyCount) readyIndex = 0;
    showLines("PESANAN READY", readyOrders[readyIndex].code);
  } else if (visibleCode != "" && millis() - codeShownAt < CODE_VISIBLE_MS) {
    showLines("KODE PESANAN", visibleCode);
  } else {
    visibleCode = "";
    showLines("DELQUEUE READY", "TEKAN AMBIL");
  }
}

void setup() {
  Serial.begin(115200);
  pinMode(PIN_ISSUE_BUTTON, INPUT_PULLUP);
  pinMode(PIN_PREV_BUTTON, INPUT_PULLUP);
  pinMode(PIN_NEXT_BUTTON, INPUT_PULLUP);
  attachInterrupt(digitalPinToInterrupt(PIN_ISSUE_BUTTON), onIssueButton, FALLING);
  attachInterrupt(digitalPinToInterrupt(PIN_PREV_BUTTON), onPrevButton, FALLING);
  attachInterrupt(digitalPinToInterrupt(PIN_NEXT_BUTTON), onNextButton, FALLING);
  pinMode(PIN_BUZZER, OUTPUT);
  digitalWrite(PIN_BUZZER, LOW);
  Wire.begin(PIN_SDA, PIN_SCL);
  lcd.init();
  lcd.backlight();
  showLines("DELQUEUE", "BOOTING");
  connectWifi();
  heartbeat();
  showLines("DELQUEUE READY", "TEKAN AMBIL");
}

void loop() {
  if (consumeButton(issueButtonFlag)) createCode();
  if (consumeButton(prevButtonFlag) && readyCount > 0) {
    readyIndex = (readyIndex + readyCount - 1) % readyCount;
    showLines("PESANAN READY", readyOrders[readyIndex].code);
  }
  if (consumeButton(nextButtonFlag) && readyCount > 0) {
    readyIndex = (readyIndex + 1) % readyCount;
    showLines("PESANAN READY", readyOrders[readyIndex].code);
  }
  pollDisplay();
}
