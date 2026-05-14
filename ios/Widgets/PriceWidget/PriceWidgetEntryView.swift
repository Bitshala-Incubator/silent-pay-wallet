//
//  PriceWidgetEntryView.swift
//  Shroud
//
//  Created by Marcos Rodriguez on 10/27/24.
//  Copyright © 2026 Shroud contributors. All rights reserved.
//

import SwiftUI


@available(iOS 16.0, *)
struct PriceWidgetEntryView: View {
    let entry: PriceWidgetEntry

    var body: some View {
        PriceView(entry: entry)
    }
}
