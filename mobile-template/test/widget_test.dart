import 'package:flutter_test/flutter_test.dart';
import 'package:mobile_template/main.dart';

void main() {
  testWidgets('Sample screen renders smoke test', (WidgetTester tester) async {
    await tester.pumpWidget(const MobileTemplateApp());

    expect(find.text('Plantilla Móvil Inicial'), findsOneWidget);
    expect(find.text('sqflite'), findsOneWidget);
    expect(find.text('speech_to_text'), findsOneWidget);
  });
}
