# Groundwater Evidence Ledger

A pump-based record of groundwater extraction from PG&E SmartMeter reads. It attributes energy to each well, converts that energy to acre-feet from a pump test, and keeps a hash-chained history so a later correction does not erase the original read.

The Package view exports a brief and a JSON file that separate source measurements, assumptions, arithmetic, and the resulting volume, for comparison with a groundwater sustainability agency notice.

This is not a live utility connection. A sample ranch is loaded so the record can be read before your own meter CSV is imported. Data stays in the browser.

## Run

```bash
npm install
npm run dev
```

Then open the app on port 8080.
