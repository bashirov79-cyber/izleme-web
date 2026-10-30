# izleme-web

MEDİGROUP sifariş, anbar və sənəd izləmə tətbiqinin (izleme.medigroup.az) veb faylları.

- `web/` — saytda olan fayllar.
- `manifest.txt` — yerləşdiriləcək faylların siyahısı və SHA-256 yoxlama cəmləri.
- `scripts/izleme-deploy.sh` — hostinqdə cron ilə hər 5 dəqiqədən bir işləyən skript: `manifest.txt` dəyişibsə, faylları yükləyir, yoxlama cəmini tutuşdurur, köhnə nüsxəni saxlayıb yenisini yazır.

Verilənlər bazası (Supabase) bu repoda deyil; burada heç bir şifrə və ya gizli açar saxlanılmır.
