ALTER TABLE logistics_io
ADD COLUMN gate_out_no_of_invoice INTEGER,
ADD COLUMN gate_out_invoice_nos TEXT[],
ADD COLUMN gate_out_bill_nos TEXT[];