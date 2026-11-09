// Ground-truth sketch: STAT LED (GPIO 0) and RGB LED (GPIO 46) on the SparkFun ESP32-S3 Thing Plus
void setup() {
  Serial.begin(115200);
  pinMode(0, OUTPUT);
}

void loop() {
  digitalWrite(0, HIGH);
  rgbLedWrite(46, 0, 30, 0);
  Serial.println("on");
  delay(500);
  digitalWrite(0, LOW);
  rgbLedWrite(46, 0, 0, 0);
  Serial.println("off");
  delay(500);
}
