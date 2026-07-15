# ESP32 Wiring

- LCD SDA: `GPIO 21`
- LCD SCL: `GPIO 22`
- Large issue-code button: `GPIO 25 -> button -> GND`
- Previous READY button: `GPIO 26 -> button -> GND`
- Next READY button: `GPIO 27 -> button -> GND`
- Buzzer candidate: `GPIO 33`

Buttons use `INPUT_PULLUP`; no VCC is needed for the buttons.

The buzzer is disabled by default. Use an NPN transistor driver, base resistor, common ground, and a suitable power source before enabling it. Do not assume an unknown active buzzer is safe to drive directly from ESP32 GPIO.
