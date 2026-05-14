//
//  FiatUnit.swift
//  Shroud
//
//  Created by Marcos Rodriguez on 11/20/20.
//  Copyright © 2026 Shroud contributors. All rights reserved.
//
import Foundation

struct FiatUnit: Codable {
  let endPointKey: String
  let symbol: String
  let locale: String
  let source: String
  
}

func fiatUnit(currency: String) -> FiatUnit? {
  return Bundle.main.decode([String: FiatUnit].self, from: "fiatUnits.json").first(where: {$1.endPointKey == currency})?.value
}
