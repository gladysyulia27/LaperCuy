# ESP32 Firmware

Firmware is in `firmware/esp32-delqueue`.

Setup:

```sh
cd firmware/esp32-delqueue
cp include/secrets.example.h include/secrets.h
pio run
```

The terminal:

- connects Wi-Fi;
- sends heartbeat;
- requests codes with `X-Request-ID`;
- polls `/api/device/display-state`;
- displays READY orders with previous/next buttons;
- beeps only once for newly seen READY order IDs when buzzer support is safely enabled.

The firmware does not create authoritative queue codes locally.
