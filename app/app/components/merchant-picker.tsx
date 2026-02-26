"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, MapPin } from "lucide-react";
import type { Merchant } from "@/lib/receipt/types";

interface PlaceSuggestion {
  place_id: string;
  description: string;
}

interface MerchantPickerProps {
  merchant: Merchant;
  onSelect: (merchant: Merchant) => void;
}

export function MerchantPicker({ merchant, onSelect }: MerchantPickerProps) {
  const [query, setQuery] = useState(merchant.name || "");
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const searchPlaces = useCallback(async (searchQuery: string) => {
    if (!searchQuery || searchQuery.length < 2) {
      setSuggestions([]);
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(
        `/api/places-app/autocomplete?q=${encodeURIComponent(searchQuery)}`
      );
      const data = await response.json();
      setSuggestions(data.suggestions || []);
    } catch (error) {
      console.error("Failed to fetch places:", error);
      setSuggestions([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      searchPlaces(query);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [query, searchPlaces]);

  const handleSelectPlace = async (placeId: string, description: string) => {
    try {
      const response = await fetch(
        `/api/places-app/details?placeId=${encodeURIComponent(placeId)}`
      );
      const data = await response.json();
      
      onSelect({
        name: data.name || description,
        placeId: data.placeId,
        category: data.category,
        country: data.country,
      });
      
      setQuery(data.name || description);
      setSuggestions([]);
    } catch (error) {
      console.error("Failed to fetch place details:", error);
    }
  };

  const handleManualEntry = () => {
    onSelect({
      name: query,
      category: undefined,
      country: undefined,
    });
    setSuggestions([]);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Merchant Information</CardTitle>
        <CardDescription>Search for the merchant or enter manually</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="merchant-search">Merchant Name</Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="merchant-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search for merchant..."
              className="pl-10"
            />
          </div>
        </div>

        {suggestions.length > 0 && (
          <div className="border rounded-lg p-2 space-y-1 max-h-48 overflow-y-auto">
            {suggestions.map((suggestion) => (
              <button
                key={suggestion.place_id}
                onClick={() => handleSelectPlace(suggestion.place_id, suggestion.description)}
                className="w-full text-left p-2 hover:bg-muted rounded flex items-start gap-2"
              >
                <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                <span className="text-sm">{suggestion.description}</span>
              </button>
            ))}
          </div>
        )}

        {query && suggestions.length === 0 && !isLoading && (
          <Button variant="outline" onClick={handleManualEntry} className="w-full">
            Use "{query}" as merchant name
          </Button>
        )}

        {merchant.name && (
          <div className="pt-4 border-t space-y-2">
            <div className="flex items-center gap-2">
              <span className="font-medium">Selected:</span>
              <span>{merchant.name}</span>
            </div>
            {merchant.category && (
              <Badge variant="secondary">{merchant.category}</Badge>
            )}
            {merchant.country && (
              <Badge variant="outline">{merchant.country}</Badge>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}






