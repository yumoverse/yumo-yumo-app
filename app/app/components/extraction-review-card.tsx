"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Extraction } from "@/lib/receipt/types";

interface ExtractionReviewCardProps {
  extraction: Extraction;
  onUpdate?: (extraction: Extraction) => void; // Made optional since we don't allow edits
}

export function ExtractionReviewCard({
  extraction,
}: ExtractionReviewCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Extracted Information</CardTitle>
        <CardDescription>
          Server-side extraction results (read-only)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Date</span>
            <Badge variant={extraction.date.confidence >= 0.7 ? "default" : "secondary"}>
              Confidence: {(extraction.date.confidence * 100).toFixed(0)}%
            </Badge>
          </div>
          <p className="text-lg font-semibold">{extraction.date.value}</p>
          {extraction.date.sourceLine && (
            <span className="text-xs text-muted-foreground">
              Extracted from line {extraction.date.sourceLine}
            </span>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Total Amount</span>
            <Badge variant={extraction.total.confidence >= 0.7 ? "default" : "secondary"}>
              Confidence: {(extraction.total.confidence * 100).toFixed(0)}%
            </Badge>
          </div>
          <p className="text-lg font-semibold">
            {typeof extraction.total.value === 'number' 
              ? extraction.total.value.toFixed(2)
              : extraction.total.value}
            {extraction.total.currency && ` ${extraction.total.currency}`}
          </p>
          {extraction.total.sourceLine && (
            <span className="text-xs text-muted-foreground">
              Extracted from line {extraction.total.sourceLine}
            </span>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">VAT Amount</span>
            <div className="flex items-center gap-2">
              <Badge variant={extraction.vat.confidence >= 0.7 ? "default" : "secondary"}>
                Confidence: {(extraction.vat.confidence * 100).toFixed(0)}%
              </Badge>
              {extraction.vat.rate && (
                <Badge variant="outline">
                  Rate: {(extraction.vat.rate * 100).toFixed(0)}%
                </Badge>
              )}
            </div>
          </div>
          <p className="text-lg font-semibold">{extraction.vat.value.toFixed(2)}</p>
          {extraction.vat.sourceLine && (
            <span className="text-xs text-muted-foreground">
              Extracted from line {extraction.vat.sourceLine}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}


