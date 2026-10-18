# gogogo.social

Static export of gogogo from [friday-circle](https://github.com/biigJ/friday-circle).
Do not edit by hand — run `scripts/deploy-gogogo-social.sh` from friday-circle instead.

Deploy: Vercel project **gogogo-social** (domain gogogo.social). GitHub Pages is disabled.

`/zirkeltraining/` proxies the live Vercel app at `https://zirkeltraining.vercel.app`. `/zirkeltraining` redirects to `/zirkeltraining/`. That app loads its scripts from `/_next`, so those paths are proxied too. Do not add a `zirkeltraining/` folder here — static files override the proxy.
