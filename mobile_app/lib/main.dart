import 'package:flutter/material.dart';

import 'app/horse_app.dart';
import 'core/api/providers_api.dart';
import 'core/api/supabase_api.dart';
import 'core/data/catalog_repository.dart';
import 'core/state/app_state.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  final appState = AppState(
    CatalogRepository(),
    SupabaseApi(),
    ProvidersApi(),
  );
  runApp(HorseApp(state: appState));
}
