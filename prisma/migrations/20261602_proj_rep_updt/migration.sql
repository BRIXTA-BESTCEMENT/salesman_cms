ALTER TABLE projection_reports
ADD CONSTRAINT projection_reports_unique_key
UNIQUE (
  report_date,
  order_dealer_name,
  collection_dealer_name,
  institution,
  zone
);
