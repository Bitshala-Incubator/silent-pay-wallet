//
//  Widgets.swift
//  Widgets
//
//  Created by Marcos Rodriguez on 6/6/21.
//  Copyright © 2026 Shroud contributors. All rights reserved.
//

import WidgetKit
import SwiftUI

@main
struct Widgets: WidgetBundle {
    @WidgetBundleBuilder
    var body: some Widget {
        PriceWidget()
        WalletInformationWidget()
        MarketWidget()
        WalletInformationAndMarketWidget()
    }
}
