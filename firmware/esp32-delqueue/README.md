# ESP32 DelQueue Terminal

Hardware:

- LCD I2C 16x2 address `0x27`
- SDA `GPIO 21`
- SCL `GPIO 22`
- large issue-code button `GPIO 25` to GND
- previous READY button `GPIO 26` to GND
- next READY button `GPIO 27` to GND
- buzzer candidate `GPIO 33`

Buttons use `INPUT_PULLUP`, so wire each button from GPIO to GND.

Copy `include/secrets.example.h` to `include/secrets.h` and fill Wi-Fi, API URL, device key, and device ID. `secrets.h` is ignored by Git.

The firmware asks the backend for all codes. It does not generate authoritative queue codes locally. `X-Request-ID` is reused for the in-flight request to avoid duplicate code issuance during retries.

## Buzzer Safety

`BUZZER_ENABLED` defaults to `false`. Do not drive an unknown active buzzer directly from an ESP32 GPIO. Use a small NPN transistor such as 2N2222, S8050, or BC547, an appropriate base resistor, common ground, and an external supply if required by the buzzer voltage/current.

The current HTTPS implementation uses `setInsecure()` for prototype compatibility. For production hardware, install and pin the proper CA certificate or certificate fingerprint strategy.
