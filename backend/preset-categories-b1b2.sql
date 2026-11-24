-- backend/preset-categories-b1b2.sql
-- LU-06 (24.11.2026): 8 Vorlagen-Sammlungen für ältere Kinder (Kl. 8–13), Stufe B1/B2,
-- je 12 Wörter, nur Wörter (keine Sätze). Stufe „schwer“, sort_order 410–480 = ganz hinten,
-- im Kampf-Nachschub also erst nach allen anderen Vorlagen.
-- AUSFÜHREN: komplette Datei in den Supabase-SQL-Editor, Run. Mehrfach unschädlich
-- (ON CONFLICT (slug) DO NOTHING). Die letzte Anweisung zeigt die Kontrolle (Soll: 8).

INSERT INTO preset_categories (name, slug, sort_order, difficulty, words) VALUES
('Gesellschaft & Politik · B1', 'b1-gesellschaft', 410, 'schwer', '[
  {"de":"Regierung","en":"government"},
  {"de":"Wahl","en":"election"},
  {"de":"Gesetz","en":"law"},
  {"de":"Bürger","en":"citizen"},
  {"de":"Gesellschaft","en":"society"},
  {"de":"Demokratie","en":"democracy"},
  {"de":"Parlament","en":"parliament"},
  {"de":"Minderheit","en":"minority"},
  {"de":"Steuer","en":"tax"},
  {"de":"Armut","en":"poverty"},
  {"de":"Freiheit","en":"freedom"},
  {"de":"wählen","en":"vote"}
]'::jsonb),

('Medien & Nachrichten · B1', 'b1-medien', 420, 'schwer', '[
  {"de":"Schlagzeile","en":"headline"},
  {"de":"Artikel","en":"article"},
  {"de":"Werbung","en":"advertising"},
  {"de":"Quelle","en":"source"},
  {"de":"Meinung","en":"opinion"},
  {"de":"Umfrage","en":"survey"},
  {"de":"Journalist","en":"journalist"},
  {"de":"veröffentlichen","en":"publish"},
  {"de":"beeinflussen","en":"influence"},
  {"de":"Datenschutz","en":"privacy"},
  {"de":"zuverlässig","en":"reliable"},
  {"de":"Beitrag","en":"post"}
]'::jsonb),

('Arbeit & Beruf · B1', 'b1-beruf', 430, 'schwer', '[
  {"de":"Bewerbung","en":"application"},
  {"de":"Lebenslauf","en":"CV"},
  {"de":"Vorstellungsgespräch","en":"interview"},
  {"de":"Gehalt","en":"salary"},
  {"de":"Arbeitgeber","en":"employer"},
  {"de":"Arbeitnehmer","en":"employee"},
  {"de":"Erfahrung","en":"experience"},
  {"de":"Praktikum","en":"internship"},
  {"de":"Kollege","en":"colleague"},
  {"de":"Firma","en":"company"},
  {"de":"Fähigkeit","en":"skill"},
  {"de":"sich bewerben","en":"apply"}
]'::jsonb),

('Gesundheit · B1', 'b1-gesundheit', 440, 'schwer', '[
  {"de":"Ernährung","en":"nutrition"},
  {"de":"Verletzung","en":"injury"},
  {"de":"Behandlung","en":"treatment"},
  {"de":"Schmerz","en":"pain"},
  {"de":"Sucht","en":"addiction"},
  {"de":"Impfung","en":"vaccination"},
  {"de":"Gewohnheit","en":"habit"},
  {"de":"sich erholen","en":"recover"},
  {"de":"vermeiden","en":"avoid"},
  {"de":"ausgewogen","en":"balanced"},
  {"de":"Bewegung","en":"exercise"},
  {"de":"Ausdauer","en":"stamina"}
]'::jsonb),

('Gefühle & Beziehungen · B1', 'b1-gefuehle', 450, 'schwer', '[
  {"de":"eifersüchtig","en":"jealous"},
  {"de":"enttäuscht","en":"disappointed"},
  {"de":"erleichtert","en":"relieved"},
  {"de":"stolz","en":"proud"},
  {"de":"verlegen","en":"embarrassed"},
  {"de":"zuversichtlich","en":"confident"},
  {"de":"dankbar","en":"grateful"},
  {"de":"besorgt","en":"worried"},
  {"de":"Vertrauen","en":"trust"},
  {"de":"Beziehung","en":"relationship"},
  {"de":"sich entschuldigen","en":"apologise"},
  {"de":"vergeben","en":"forgive"}
]'::jsonb),

('Wissenschaft & Technik · B2', 'b2-wissenschaft', 460, 'schwer', '[
  {"de":"Forschung","en":"research"},
  {"de":"Erfindung","en":"invention"},
  {"de":"Entdeckung","en":"discovery"},
  {"de":"Experiment","en":"experiment"},
  {"de":"Beweis","en":"evidence"},
  {"de":"Gerät","en":"device"},
  {"de":"Entwicklung","en":"development"},
  {"de":"Wissenschaftler","en":"scientist"},
  {"de":"Beobachtung","en":"observation"},
  {"de":"messen","en":"measure"},
  {"de":"untersuchen","en":"investigate"},
  {"de":"Daten","en":"data"}
]'::jsonb),

('Meinung & Diskussion · B2', 'b2-diskussion', 470, 'schwer', '[
  {"de":"behaupten","en":"claim"},
  {"de":"überzeugen","en":"convince"},
  {"de":"zustimmen","en":"agree"},
  {"de":"ablehnen","en":"reject"},
  {"de":"Argument","en":"argument"},
  {"de":"Vorteil","en":"advantage"},
  {"de":"Nachteil","en":"disadvantage"},
  {"de":"jedoch","en":"however"},
  {"de":"deshalb","en":"therefore"},
  {"de":"obwohl","en":"although"},
  {"de":"Schlussfolgerung","en":"conclusion"},
  {"de":"Gleichberechtigung","en":"equality"}
]'::jsonb),

('Klima & Natur · B2', 'b2-klima', 480, 'schwer', '[
  {"de":"Lebensraum","en":"habitat"},
  {"de":"Aussterben","en":"extinction"},
  {"de":"gefährdet","en":"endangered"},
  {"de":"nachhaltig","en":"sustainable"},
  {"de":"Abholzung","en":"deforestation"},
  {"de":"Ausstoß","en":"emissions"},
  {"de":"erneuerbar","en":"renewable"},
  {"de":"Abfall","en":"waste"},
  {"de":"Rohstoff","en":"resource"},
  {"de":"schützen","en":"protect"},
  {"de":"verringern","en":"reduce"},
  {"de":"Dürre","en":"drought"}
]'::jsonb)

ON CONFLICT (slug) DO NOTHING;

SELECT count(*) AS b1b2_soll_8 FROM preset_categories WHERE slug LIKE 'b1-%' OR slug LIKE 'b2-%';
