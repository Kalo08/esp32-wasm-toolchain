// io.m, translated to Arduino C++ by KaloLab. Board output goes to the USB serial port at 115200 baud.
#include <Arduino.h>
#include <esp_random.h>
#include <vector>
#include <cmath>
#include <stdexcept>
#include <algorithm>
#pragma GCC diagnostic ignored "-Wunused-function"
#pragma GCC diagnostic ignored "-Wunused-variable"
#pragma GCC diagnostic ignored "-Wunused-but-set-variable"

typedef std::vector<double> Vec;
static int KL_LINE = 0;
static void kl_error(const String& m) { throw std::runtime_error(m.c_str()); }

// ---- text ----
static String kl_num2str(double v) {
  char b[40];
  if (std::isnan(v)) return "NaN";
  if (std::isinf(v)) return v > 0 ? "Inf" : "-Inf";
  if (v == std::floor(v) && std::fabs(v) < 1e15) { snprintf(b, sizeof b, "%lld", (long long)v); return b; }
  int d = (int)std::floor(std::log10(std::fabs(v))) + 5;
  if (d < 1) d = 1;
  snprintf(b, sizeof b, "%.*g", d, v);
  return b;
}
static String kl_num2str(const Vec& v) { String o; for (size_t i = 0; i < v.size(); i++) { if (i) o += "  "; o += kl_num2str(v[i]); } return o; }
static String kl_num2str(const String& s) { return s; }
static String kl_num2str(double v, const String& f);
static String kl_str(double v) { return kl_num2str(v); }
static String kl_str(const String& s) { return s; }
static String kl_str(const char* s) { return String(s); }
static String kl_fmt(double v) {
  if (std::isnan(v)) return "NaN";
  if (std::isinf(v)) return v > 0 ? "Inf" : "-Inf";
  char b[40];
  if (v == std::floor(v) && std::fabs(v) < 1e15) snprintf(b, sizeof b, "%lld", (long long)v); else snprintf(b, sizeof b, "%.4f", v);
  return b;
}
static void kl_disp(double v) { Serial.println(kl_fmt(v)); }
static void kl_disp(const String& s) { Serial.println(s); }
static void kl_disp(const char* s) { Serial.println(s); }
static void kl_disp(const Vec& v) { if (v.empty()) return; String o; for (size_t i = 0; i < v.size(); i++) { if (i) o += "    "; o += kl_fmt(v[i]); } Serial.println(o); }
static void kl_show(const char* n, double v) { Serial.print(n); Serial.print(" = "); Serial.println(kl_fmt(v)); }
static void kl_show(const char* n, const String& s) { Serial.print(n); Serial.print(" = '"); Serial.print(s); Serial.println("'"); }
static void kl_show(const char* n, const Vec& v) { Serial.print(n); Serial.print(" = "); String o; for (size_t i = 0; i < v.size(); i++) { if (i) o += "    "; o += kl_fmt(v[i]); } Serial.println(v.empty() ? String("[]") : o); }

// fprintf / sprintf with MATLAB's rules: vectors spread out, the format repeats while values remain
struct KArg { bool isStr; double d; String s; };
static void kl_push(std::vector<KArg>& a, double d) { a.push_back({false, d, String()}); }
static void kl_push(std::vector<KArg>& a, int d) { a.push_back({false, (double)d, String()}); }
static void kl_push(std::vector<KArg>& a, bool d) { a.push_back({false, d ? 1.0 : 0.0, String()}); }
static void kl_push(std::vector<KArg>& a, const String& s) { a.push_back({true, 0, s}); }
static void kl_push(std::vector<KArg>& a, const char* s) { a.push_back({true, 0, String(s)}); }
static void kl_push(std::vector<KArg>& a, const Vec& v) { for (double d : v) kl_push(a, d); }
static String kl_escapes(const String& f) {
  String o;
  for (unsigned i = 0; i < f.length(); i++) {
    char c = f[i];
    if (c == '\\' && i + 1 < f.length()) {
      char n = f[++i];
      if (n == 'n') o += '\n'; else if (n == 't') o += '\t'; else if (n == 'r') o += '\r'; else if (n == '\\') o += '\\';
      else if (n == 'a') o += '\a'; else if (n == '0') o += '\0'; else { o += '\\'; o += n; }
    } else o += c;
  }
  return o;
}
static String kl_format(const String& f0, const std::vector<KArg>& a) {
  String f = kl_escapes(f0), o;
  size_t k = 0;
  bool any = false;
  for (unsigned i = 0; i < f.length(); i++) if (f[i] == '%') { if (i + 1 < f.length() && f[i + 1] == '%') i++; else any = true; }
  do {
    for (unsigned i = 0; i < f.length(); i++) {
      char c = f[i];
      if (c != '%') { o += c; continue; }
      if (i + 1 < f.length() && f[i + 1] == '%') { o += '%'; i++; continue; }
      unsigned j = i + 1;
      while (j < f.length() && strchr("-+ #0123456789.", f[j])) j++;
      if (j >= f.length()) break;
      if (k >= a.size()) { if (a.empty() && k == 0) { i = j; continue; } return o; }
      String spec = f.substring(i, j);
      char t = f[j];
      const KArg& v = a[k++];
      char b[96];
      if (v.isStr) {
        if (t == 'd' || t == 'i' || t == 'u' || t == 'f' || t == 'g' || t == 'e' || t == 'x' || t == 'c' || t == 's') snprintf(b, sizeof b, (spec + "s").c_str(), v.s.c_str());
        else snprintf(b, sizeof b, "%s", v.s.c_str());
      } else if (t == 's') {
        snprintf(b, sizeof b, (spec + "s").c_str(), kl_num2str(v.d).c_str());
      } else if (t == 'd' || t == 'i' || t == 'u') {
        if (v.d == std::floor(v.d) && std::fabs(v.d) < 9e18) snprintf(b, sizeof b, (spec + "lld").c_str(), (long long)v.d);
        else snprintf(b, sizeof b, (spec + "g").c_str(), v.d);
      } else if (t == 'x' || t == 'X' || t == 'o') {
        snprintf(b, sizeof b, (spec + "ll" + String(t)).c_str(), (long long)v.d);
      } else if (t == 'c') {
        snprintf(b, sizeof b, "%c", (char)v.d);
      } else {
        snprintf(b, sizeof b, (spec + String(t)).c_str(), v.d);
      }
      o += b;
      i = j;
    }
  } while (any && k < a.size() && k > 0);
  return o;
}
template <typename... T> static String kl_sprintf(const String& f, const T&... xs) { std::vector<KArg> a; (kl_push(a, xs), ...); return kl_format(f, a); }
template <typename... T> static void kl_fprintf(const String& f, const T&... xs) { Serial.print(kl_sprintf(f, xs...)); }
static String kl_num2str(double v, const String& f) { return kl_sprintf(f, v); }

// ---- vectors (1-based, like MATLAB) ----
static size_t kl_i(double k, size_t n) {
  if (k != std::floor(k) || k < 1) kl_error("Index must be a positive whole number, not " + kl_num2str(k) + ".");
  if ((size_t)k > n) kl_error("Index " + kl_num2str(k) + " is out of range: the array has " + String((unsigned)n) + " elements.");
  return (size_t)k - 1;
}
static double kl_at(const Vec& v, double k) { return v[kl_i(k, v.size())]; }
static double kl_at(double x, double k) { if (k != 1) kl_error("Index exceeds the number of array elements (1)."); return x; }
static String kl_at(const String& s, double k) { return String(s[kl_i(k, s.length())]); }
static Vec kl_idx(const Vec& v, const Vec& k) {
  Vec o;
  bool mask = k.size() == v.size() && std::all_of(k.begin(), k.end(), [](double x) { return x == 0 || x == 1; }) && k.size() > 0 && !(k.size() == 1);
  if (mask) { for (size_t i = 0; i < v.size(); i++) if (k[i]) o.push_back(v[i]); return o; }
  for (double i : k) o.push_back(kl_at(v, i));
  return o;
}
static void kl_set(Vec& v, double k, double x) {
  if (k != std::floor(k) || k < 1) kl_error("Index must be a positive whole number, not " + kl_num2str(k) + ".");
  if ((size_t)k > v.size()) v.resize((size_t)k, 0);
  v[(size_t)k - 1] = x;
}
static void kl_set(Vec& v, const Vec& k, double x) { for (double i : k) kl_set(v, i, x); }
static void kl_set(Vec& v, const Vec& k, const Vec& x) { if (k.size() != x.size()) kl_error("The number of values doesn't match the number of positions."); for (size_t j = 0; j < k.size(); j++) kl_set(v, k[j], x[j]); }
static Vec kl_vec(double x) { return Vec{x}; }
static Vec kl_vec(const Vec& x) { return x; } // a copy: for (x : kl_vec(temporary)) must not dangle
static Vec kl_cat(std::initializer_list<Vec> parts) { Vec o; for (const Vec& p : parts) o.insert(o.end(), p.begin(), p.end()); return o; }
static Vec kl_range(double a, double s, double b) {
  Vec o;
  if (s == 0 || (s > 0 && a > b) || (s < 0 && a < b)) return o;
  long n = (long)std::floor((b - a) / s + 1e-10);
  for (long i = 0; i <= n; i++) o.push_back(a + i * s);
  return o;
}
static Vec kl_fill(double r, double c, double x) {
  if (r != 1 && c != 1) kl_error("Matrices (" + kl_num2str(r) + " by " + kl_num2str(c) + ") can't be used in C++ on the board: use a vector, like zeros(1, n).");
  Vec o((size_t)std::max(0.0, r * c), x);
  return o;
}
static Vec kl_linspace(double a, double b, double n = 100) { Vec o; long m = (long)n; if (m < 2) { o.push_back(b); return o; } for (long i = 0; i < m; i++) o.push_back(a + (b - a) * i / (m - 1)); return o; }
static double kl_numel(const Vec& v) { return (double)v.size(); }
static double kl_numel(double) { return 1; }
static double kl_numel(const String& s) { return (double)s.length(); }
static double kl_sum(const Vec& v) { double s = 0; for (double x : v) s += x; return s; }
static double kl_sum(double x) { return x; }
static double kl_prod(const Vec& v) { double s = 1; for (double x : v) s *= x; return s; }
static double kl_mean(const Vec& v) { return v.empty() ? NAN : kl_sum(v) / v.size(); }
static double kl_mean(double x) { return x; }
static double kl_median(Vec v) { if (v.empty()) return NAN; std::sort(v.begin(), v.end()); size_t n = v.size(); return n % 2 ? v[n / 2] : (v[n / 2 - 1] + v[n / 2]) / 2; }
static double kl_std(const Vec& v) { size_t n = v.size(); if (n < 2) return 0; double m = kl_mean(v), s = 0; for (double x : v) s += (x - m) * (x - m); return std::sqrt(s / (n - 1)); }
static double kl_max(const Vec& v, double* at = nullptr) { if (v.empty()) kl_error("max of an empty vector."); size_t i = 0; for (size_t k = 1; k < v.size(); k++) if (v[k] > v[i]) i = k; if (at) *at = i + 1; return v[i]; }
static double kl_min(const Vec& v, double* at = nullptr) { if (v.empty()) kl_error("min of an empty vector."); size_t i = 0; for (size_t k = 1; k < v.size(); k++) if (v[k] < v[i]) i = k; if (at) *at = i + 1; return v[i]; }
static double kl_max(double x, double* at = nullptr) { if (at) *at = 1; return x; }
static double kl_min(double x, double* at = nullptr) { if (at) *at = 1; return x; }
static Vec kl_sort(const Vec& v, const String& d = "ascend", Vec* at = nullptr) {
  std::vector<size_t> ix(v.size());
  for (size_t i = 0; i < ix.size(); i++) ix[i] = i;
  bool down = d.startsWith("d") || d.startsWith("D");
  std::stable_sort(ix.begin(), ix.end(), [&](size_t a, size_t b) { return down ? v[a] > v[b] : v[a] < v[b]; });
  Vec o;
  for (size_t i : ix) o.push_back(v[i]);
  if (at) { at->clear(); for (size_t i : ix) at->push_back(i + 1); }
  return o;
}
static Vec kl_find(const Vec& v) { Vec o; for (size_t i = 0; i < v.size(); i++) if (v[i]) o.push_back(i + 1); return o; }
static Vec kl_cumsum(const Vec& v) { Vec o; double s = 0; for (double x : v) { s += x; o.push_back(s); } return o; }
static Vec kl_diff(const Vec& v) { Vec o; for (size_t i = 1; i < v.size(); i++) o.push_back(v[i] - v[i - 1]); return o; }
static Vec kl_flip(Vec v) { std::reverse(v.begin(), v.end()); return v; }
static double kl_any(const Vec& v) { for (double x : v) if (x) return 1; return 0; }
static double kl_all(const Vec& v) { for (double x : v) if (!x) return 0; return 1; }
static double kl_any(double x) { return x != 0; }
static double kl_all(double x) { return x != 0; }
static bool kl_true(double x) { return x != 0; }
static bool kl_true(const Vec& v) { return !v.empty() && kl_all(v); }
static bool kl_true(const String& s) { return s.length() > 0; }
static double kl_isempty(const Vec& v) { return v.empty(); }
static double kl_isempty(const String& s) { return s.length() == 0; }
static double kl_isempty(double) { return 0; }
static double kl_mod(double a, double b) { return b == 0 ? a : a - std::floor(a / b) * b; }
static double kl_sign(double x) { return (x > 0) - (x < 0); }
template <typename F> static Vec kl_map(const Vec& v, F f) { Vec o; o.reserve(v.size()); for (double x : v) o.push_back(f(x)); return o; }

// elementwise operators: vector with vector (same length) or with a number
#define KL_EW(NAME, EXPR) \
  static double NAME(double a, double b) { return EXPR; } \
  static Vec NAME(const Vec& x, double b) { Vec o; o.reserve(x.size()); for (double a : x) o.push_back(EXPR); return o; } \
  static Vec NAME(double a, const Vec& y) { Vec o; o.reserve(y.size()); for (double b : y) o.push_back(EXPR); return o; } \
  static Vec NAME(const Vec& x, const Vec& y) { \
    if (x.size() != y.size()) kl_error("Arrays have incompatible sizes for this operation (" + String((unsigned)x.size()) + " and " + String((unsigned)y.size()) + " elements)."); \
    Vec o; o.reserve(x.size()); for (size_t i = 0; i < x.size(); i++) { double a = x[i], b = y[i]; o.push_back(EXPR); } return o; }
KL_EW(kl_add, a + b)
KL_EW(kl_sub, a - b)
KL_EW(kl_mul, a * b)
KL_EW(kl_div, a / b)
KL_EW(kl_pow, std::pow(a, b))
KL_EW(kl_lt, (double)(a < b))
KL_EW(kl_le, (double)(a <= b))
KL_EW(kl_gt, (double)(a > b))
KL_EW(kl_ge, (double)(a >= b))
KL_EW(kl_eq, (double)(a == b))
KL_EW(kl_ne, (double)(a != b))
KL_EW(kl_and, (double)(a != 0 && b != 0))
KL_EW(kl_or, (double)(a != 0 || b != 0))
static Vec kl_neg(const Vec& v) { return kl_map(v, [](double x) { return -x; }); }
static double kl_neg(double x) { return -x; }
static Vec kl_not(const Vec& v) { return kl_map(v, [](double x) { return (double)(x == 0); }); }
static double kl_not(double x) { return x == 0; }

// ---- time ----
static unsigned long KL_T0 = 0;
static void kl_tic() { KL_T0 = millis(); }
static double kl_toc() { return (millis() - KL_T0) / 1000.0; }
static void kl_pause(double s) { if (s > 0) delay((unsigned long)(s * 1000)); }

// ---- pins: MATLAB's Arduino/ESP32 functions ----
static int kl_gpio(double p) { return (int)p; }
static int kl_gpio(const String& p0) {
  String p = p0; p.trim(); p.toUpperCase();
  const char* pre[] = {"GPIO", "IO", "D", "A"};
  for (const char* s : pre) if (p.startsWith(s)) { String n = p.substring(strlen(s)); if (n.length() && isDigit(n[0])) return n.toInt(); }
  if (p.length() && isDigit(p[0])) return p.toInt();
  kl_error("Unknown pin '" + p0 + "'. Use a GPIO number like 'D13' or 13.");
  return -1;
}
static int8_t KL_MODE[64];
static void kl_mode(int p, int m) { if (p < 0 || p >= 64) kl_error("Pin " + String(p) + " doesn't exist."); if (KL_MODE[p] != m) { if (m == 1) pinMode(p, OUTPUT); else if (m == 2) pinMode(p, INPUT); else if (m == 3) pinMode(p, INPUT_PULLUP); KL_MODE[p] = m; } }
static void kl_dw(int p, double v) { kl_mode(p, 1); digitalWrite(p, v ? HIGH : LOW); }
static double kl_dr(int p) { if (p < 0 || p >= 64) kl_error("Pin " + String(p) + " doesn't exist."); if (KL_MODE[p] != 3) kl_mode(p, 2); return digitalRead(p); }
static double kl_av(int p) {
  if (digitalPinToAnalogChannel(p) < 0) kl_error("Pin " + String(p) + " can't read voltages. ESP32-S3: use GPIO 1 to 10 (11 to 20 only without Wi-Fi). ESP32: 32 to 39.");
  KL_MODE[p] = 4;
  return analogReadMilliVolts(p) / 1000.0;
}
static void kl_pwm(int p, double d) { d = d < 0 ? 0 : d > 1 ? 1 : d; KL_MODE[p] = 5; analogWrite(p, (int)std::lround(d * 255)); }
static void kl_cfg(int p, String m) {
  m.toLowerCase();
  if (m == "pullup") kl_mode(p, 3); else if (m == "digitalinput") kl_mode(p, 2); else if (m == "digitaloutput") kl_mode(p, 1);
  else if (m == "analoginput") KL_MODE[p] = 4; else if (m == "pwm") KL_MODE[p] = 5; else if (m == "unset") KL_MODE[p] = 0;
  else kl_error("configurePin mode '" + m + "' isn't supported on the board.");
}
static void kl_rgb(int p, const Vec& c) {
  if (c.size() < 3) kl_error("writeRGB needs a colour like [0 30 0] (red, green, blue, each 0 to 255).");
  auto b = [](double v) { return (uint8_t)std::lround(v < 0 ? 0 : v > 255 ? 255 : v); };
  KL_MODE[p] = 7;
  rgbLedWrite(p, b(c[0]), b(c[1]), b(c[2]));
}
static void kl_tone(int p, double f, double d) { KL_MODE[p] = 6; if (f > 0) tone(p, (unsigned)f, (unsigned long)(d * 1000)); }



// the script itself
static void kl_script() {
  double a = 0;
  Vec x;
  double e = 0;
  double v = 0;
  KL_LINE = 1;
  a = 0.0;
  KL_LINE = 2;
  kl_cfg(14, String("Pullup"));
  KL_LINE = 3;
  kl_tone(5, 440.0, 0.2);
  KL_LINE = 4;
  kl_pwm(6, 0.5);
  KL_LINE = 5;
  kl_pwm(6, 1.65 / 3.3);
  KL_LINE = 6;
  x = kl_map(kl_fill(1.0, 3.0, 0), [](double) { return esp_random() / 4294967296.0; });
  KL_LINE = 7;
  kl_tic();
  KL_LINE = 8;
  kl_pause(0.01);
  KL_LINE = 9;
  e = kl_toc();
  KL_LINE = 10;
  v = kl_av(10);
  KL_LINE = 11;
  if ((double)(kl_dr(14) == 0.0)) {
    KL_LINE = 12;
    kl_rgb(46, Vec{40.0, 0.0, 0.0});
  }
  KL_LINE = 14;
  kl_fprintf(String("%d values, %.3f s, %.2f V\\n"), kl_numel(x), e, v);
  KL_LINE = 15;
  kl_disp((double)(kl_sum(x) > 0.0));
}


void setup() {
  Serial.begin(115200);
  unsigned long t0 = millis();
  while (!Serial && millis() - t0 < 3000) delay(10); // give a USB serial monitor a moment to attach
  delay(300);
  try {
    kl_script();
    Serial.println("\n[io.m finished]");
  } catch (const std::exception& e) {
    Serial.printf("\nError in io.m line %d: %s\n", KL_LINE, e.what());
  }
}

void loop() {
  delay(1000);
}
