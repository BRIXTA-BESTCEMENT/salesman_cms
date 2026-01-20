CREATE TABLE "logistics_gate_io" (
    "id" TEXT NOT NULL,
    "zone" VARCHAR(255),
    "district" VARCHAR(255),
    "destination" VARCHAR(255),
    
    -- DO Order
    "doOrderDate" DATE,
    "doOrderTime" VARCHAR(50),
    
    -- Gate In
    "gateInDate" DATE,
    "gateInTime" VARCHAR(50),
    
    -- Processing Time
    "processingTime" VARCHAR(100),
    
    -- WB In
    "wbInDate" DATE,
    "wbInTime" VARCHAR(50),
    
    -- Diff Gate In -> Tare
    "diffGateInTareWt" VARCHAR(100),
    
    -- WB Out
    "wbOutDate" DATE,
    "wbOutTime" VARCHAR(50),
    
    -- Diff Tare -> Gross
    "diffTareWtGrossWt" VARCHAR(100),
    
    -- Gate Out
    "gateOutDate" DATE,
    "gateOutTime" VARCHAR(50),
    
    -- Diff Gross -> Gate Out
    "diffGrossWtGateOut" VARCHAR(100),
    
    -- Invoice Diffs
    "diffGrossWtInvoiceDT" VARCHAR(100),
    "diffInvoiceDTGateOut" VARCHAR(100),
    
    -- Total TAT
    "diffGateInGateOut" VARCHAR(100),
    
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "logistics_gate_io_pkey" PRIMARY KEY ("id")
);