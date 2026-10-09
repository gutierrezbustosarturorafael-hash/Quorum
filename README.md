# Getting Started with Create React App

This project was bootstrapped with [Create React App](https://github.com/facebook/create-react-app).

## Available Scripts

In the project directory, you can run:

### `npm start`

Runs the app in the development mode.\
Open [http://localhost:3000](http://localhost:3000) to view it in your browser.

The page will reload when you make changes.\
You may also see any lint errors in the console.

### `npm test`

Launches the test runner in the interactive watch mode.\
See the section about [running tests](https://facebook.github.io/create-react-app/docs/running-tests) for more information.

### `npm run build`

Builds the app for production to the `build` folder.\
It correctly bundles React in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.\
Your app is ready to be deployed!

See the section about [deployment](https://facebook.github.io/create-react-app/docs/deployment) for more information.

### `npm run eject`

**Note: this is a one-way operation. Once you `eject`, you can't go back!**

If you aren't satisfied with the build tool and configuration choices, you can `eject` at any time. This command will remove the single build dependency from your project.

Instead, it will copy all the configuration files and the transitive dependencies (webpack, Babel, ESLint, etc) right into your project so you have full control over them. All of the commands except `eject` will still work, but they will point to the copied scripts so you can tweak them. At this point you're on your own.

You don't have to ever use `eject`. The curated feature set is suitable for small and middle deployments, and you shouldn't feel obligated to use this feature. However we understand that this tool wouldn't be useful if you couldn't customize it when you are ready for it.

## Learn More

You can learn more in the [Create React App documentation](https://facebook.github.io/create-react-app/docs/getting-started).

To learn React, check out the [React documentation](https://reactjs.org/).

### Code Splitting

This section has moved here: [https://facebook.github.io/create-react-app/docs/code-splitting](https://facebook.github.io/create-react-app/docs/code-splitting)

### Analyzing the Bundle Size

This section has moved here: [https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size](https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size)

### Making a Progressive Web App

This section has moved here: [https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app](https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app)

### Advanced Configuration

This section has moved here: [https://facebook.github.io/create-react-app/docs/advanced-configuration](https://facebook.github.io/create-react-app/docs/advanced-configuration)

### Deployment

This section has moved here: [https://facebook.github.io/create-react-app/docs/deployment](https://facebook.github.io/create-react-app/docs/deployment)

### `npm run build` fails to minify

This section has moved here: [https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify](https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify)

## Employee access and meetings

The main page has a separate **¿Eres empleado?** entry to the employee workspace at `/empleados`. From **Empresa → Acceso de empleados**, the organizer shares the company invitation code and the individual employee access link. If a legacy company has no invitation code, the organizer can generate one from this section. Employees enter the invitation code, look up the company, and select their role, department, sub-area (when applicable), contact details, and leadership responsibilities. They can update these details after signing in. Employee accounts also have their own **Configuración** window for light or dark appearance, larger text, and reduced motion; these preferences are saved on the current device independently of the organizer's settings. The account is linked to one company. Organizers who also need an employee profile can link their existing account with the same email and password. Existing employee profiles missing a confirmed leadership choice must complete it before proceeding.

The **Empresa → Empleados y directivos** directory is the single place to add, edit, and remove people. Organizers who add someone manually provide an initial password, so that person can sign in immediately with their email and password; the organizer can set a new password while editing the person's profile. The system does not send the initial password by email, so the organizer shares it directly. People who register with the company code also appear in this same directory. Directors can record the sub-areas they manage; those choices then appear in employee registration and profile editing for that department. Employees cannot choose an unlisted sub-area, promote themselves to a leadership role, or assign themselves sub-areas; the organizer must update those responsibilities in the directory. Removing a person also removes them from pending meeting invitations.

The main menu's **Empresa** section groups the institution's identifying details, employee invitation code, employee portal link, and verified address used to send meeting invitations. Personal display, document, and meeting defaults remain under **Configuración**.

The employee workspace shows that person's profile, upcoming company meetings for their area (and company-wide meetings), plus meetings to which they were explicitly invited. The **Reuniones personales** section combines invitations to personal meetings with the employee's own personal meeting log. Employees can add, edit, and delete their own log entries; those records are private to the employee and do not send invitations or change the company calendar. Each employee has a personal strategic plan with an indicator graph and indicators linked to their department. Employees and organizers use the same personal indicator list: either can add, edit, update, or remove an indicator, and it appears to both in the employee's portal and organizer's employee directory. Department heads can also see the personal indicators created by people in their department; company heads can see indicators across the company. Employees can also record their own mission, vision, values, strategies, goals, and SWOT analysis without changing the company's information. Department heads can record their team size. When an area is selected in the organizer's strategic plan, its graph, indicator list, counts, and meeting totals all use that area. When scheduling company meetings, organizers can invite whole departments or open the employee search to select individual people by area and name. If they select no department or employee, the meeting is for the whole company. A company meeting can repeat weekly until the organizer manually stops the series; already scheduled meetings remain on the calendar. Deleting a meeting also removes its uploaded files. Employees can consult meeting details and PDFs, and upload XLS/XLSX/XLSB progress documents for their own department from the employee portal (up to 15 MB). Those files are restricted to the matching department; the organizer can open them in the meeting presentation, where the workbook sheets are previewed as tables. For recognized workbook layouts, Quorum extracts indicators from summary sheets; other spreadsheet layouts remain available as tabular previews until their structure is mapped.

For the provided unit-report layouts, Quorum also extracts percentage indicators and available target/achieved totals from the `INDICADOR`, `AVANCE`, and `Resultados` summary sheets. These document-derived summaries appear in the meeting presentation and alongside the relevant department's workbook in the employee portal; they remain separate from the strategic plan and do not overwrite its indicators. The organizer uploads one initial PDF separately from area documents, previews it, and assigns a page range to each meeting area. During the presentation, each area opens the master PDF at its assigned starting page, and the organizer can switch to that area's Excel results and back. Excel `.xlsx`, `.xls`, and `.xlsb` files up to 15 MB are accepted for area progress; employees can upload their own department workbooks from the employee portal. Quorum reads the calculated values saved in the workbook, so recalculate and save the file in Excel before uploading to ensure the newest formula results appear.

Account registration displays an informational privacy notice describing the data used by company and employee accounts. Existing employee accounts with missing required profile details are prompted to complete the missing fields before accessing their meetings. The notice is a starting point, not legal advice or a guarantee of compliance; the company must verify its contact details, service providers, retention periods, and applicable legal requirements before relying on it as its formal notice.

The dashboard accepts one PDF or Word strategic plan (up to 15 MB) and keeps it available to the signed-in organization. Uploading a replacement updates the current plan.

The strategic plan lets organizers edit an indicator's title, scope, departments, description, progress, and tasks. Its graphs show each indicator separately with an independent scale and historical line. Organizers and company heads can see progress by department but not sub-area objectives; department heads and sub-area leads can see their own scope, including their managed sub-areas, in the employee workspace.

### Deploying to Railway

Deploy `backend` and `frontend` as separate Railway services, setting each service's **Root Directory** to its corresponding folder. The backend starts with `npm start` and checks `/api/health`; the frontend builds with `npm run build` and serves the production build with `npm run start:production`. The included `railway.json` files provide these commands and health checks.

Use a hosted MongoDB database such as MongoDB Atlas for production; a MongoDB instance running on a personal computer is not reachable reliably by Railway. Back up the local `sistema_gestion` database with MongoDB Database Tools (`mongodump`) and restore it into a new, empty Atlas database (`mongorestore`) before changing the backend connection. Do not use `mongorestore --drop` unless intentionally replacing the destination database.

Configure Railway service variables without committing them:

- Backend: `NODE_ENV=production`, `MONGODB_URI`, `JWT_SECRET` (at least 32 characters), `FRONTEND_URL` (the deployed frontend origin), `EMAIL_CREDENTIALS_ENCRYPTION_KEY` (64 hex characters), `TRUST_PROXY_HOPS=1`, `FORCE_HTTPS=true`, and `HTTPS_PUBLIC_ORIGIN` (the backend's HTTPS origin). Before setting up the administrator, also set `ADMIN_BOOTSTRAP_KEY` in the Railway backend service variables. The panel is available at `/administracion` on the deployed frontend.
- Frontend: `REACT_APP_API_URL` set to the backend HTTPS origin plus `/api`, for example `https://your-api-domain.up.railway.app/api`. This variable is embedded at build time, so redeploy/rebuild the frontend after changing it.

Generate secrets locally; never paste them into source files, commits, screenshots, or chat. Generate `ADMIN_BOOTSTRAP_KEY` with:

```sh
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Add that value as `ADMIN_BOOTSTRAP_KEY` to the Railway backend service, then deploy both services. Open `/administracion` on the deployed frontend and enter the email and password of your existing company account, plus the initial key. The first existing account that supplies the key becomes the administrator; no new company registration is needed. The key is ignored after an administrator has been assigned, and should then be removed from Railway. The administrator account is stored in MongoDB; the old environment-variable administrator login is no longer used. Railway's container filesystem is ephemeral, so attach a persistent volume to the backend service mounted at `/app/uploads` to preserve uploaded PDFs and Excel workbooks across deployments. Restrict the database user's privileges, configure Atlas network access for Railway, and verify sign-in, uploads, document previews, and `/api/health` after deployment.

Employee account profiles record whether the person leads a department or the company. Existing profiles without a confirmed leadership selection are required to complete it in a non-dismissible profile dialog when they next sign in.

## HTTPS deployment

Set `REACT_APP_API_URL` in the frontend environment to the API's `https://` address whenever the site is accessed over HTTPS. Browsers block requests and documents loaded over plain HTTP from a secure page.

With a VS Code Dev Tunnel, expose the backend port and use the tunnel's HTTPS address for `REACT_APP_API_URL`. The tunnel handles public HTTPS, so the backend can keep listening on local HTTP. Set `TRUST_PROXY_HOPS=1` only when one trusted tunnel/proxy sits directly in front of the backend, and keep `FRONTEND_URL` set to the frontend's actual origin.

For production behind a trusted HTTPS load balancer or reverse proxy, set `TRUST_PROXY_HOPS` to the exact number of trusted proxy hops. To redirect HTTP requests, also set `FORCE_HTTPS=true` and `HTTPS_PUBLIC_ORIGIN` to the API's public HTTPS origin (for example, `https://api.example.com`). If Node.js terminates HTTPS directly, provide both `HTTPS_KEY_PATH` and `HTTPS_CERT_PATH` pointing to valid certificate files outside the repository. Never commit or share private keys. The backend sends the browser's HTTPS-only security header on secure production requests.

## Meeting invitation email

Each company configures its sender in **Configuración → Correo para convocatorias**. The organizer enters a Gmail or Outlook address and its application password. Quorum checks the account before saving and sends invitations from that address to the selected department directors and directly invited employees. Invitation recipients are determined by the people selected for the meeting.

Before the first account is saved, the person responsible for Quorum must set `EMAIL_CREDENTIALS_ENCRYPTION_KEY` in the backend environment. Generate a persistent 32-byte key with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`; keep it private and do not change it after saving an account. For Gmail, enable two-step verification and create an application password; do not enter the normal mailbox password. A meeting is saved even if sending fails, and the result explains that its invitation was not sent.

For Gmail, use an application password rather than the regular account password. If an account cannot be saved, try again later or ask the person responsible for Quorum for help.
