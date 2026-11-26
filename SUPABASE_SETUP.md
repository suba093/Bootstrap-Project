# Full Supabase setup

This website is static. Supabase supplies registration, persistent car data, image storage, and server-enforced admin permissions. The admin portal will remain disabled until a Supabase project is configured.

## 1. Create a Supabase project

1. Open [Supabase Dashboard](https://supabase.com/dashboard) and sign in or create an account.
2. Select **New project** and choose an organization.
3. Name the project (for example, `WantedCars`), choose a database password, and select a region.
4. Save the database password somewhere private. The website does not need this password.
5. Create the project and wait until it has finished provisioning.

## 2. Create the database tables and policies

1. In VS Code, open [`supabase-setup.sql`](./supabase-setup.sql). If needed, press **Ctrl+P**, type `supabase-setup.sql`, and open that file. Do not copy this Markdown guide.
2. Click inside the SQL file, press **Ctrl+A**, then **Ctrl+C**.
3. In the Supabase project, open **SQL Editor → New query**. Click inside the query editor, press **Ctrl+A** to select anything already there, then **Ctrl+V**.
4. Check that the first line is `create extension if not exists pgcrypto;` and the editor contains the full script—not just its filename or the first line.
5. Click **Run** and wait for it to finish. If the editor runs only the statement under the cursor, select all the SQL in the query editor before clicking **Run**.

`Success. No rows returned` is normal for table/policy creation statements. To verify that the main tables were created, run this separate query:

```sql
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in ('cars', 'categories', 'admin_users')
order by table_name;
```

It should return `admin_users`, `cars`, and `categories`.

## 3. Configure the website's public Supabase credentials

1. In Supabase, open **Project Settings → API** (the API keys section may be shown separately).
2. Copy the **Project URL** and the **anon/public** or **publishable** key.
3. Open [`supabase-config.js`](./supabase-config.js) in VS Code and replace the placeholder values:

   ```js
   window.WANTEDCARS_SUPABASE_URL = 'https://YOUR_PROJECT_ID.supabase.co';
   window.WANTEDCARS_SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';
   ```

   Keep the quotes and variable names; replace only the example values.

The anon/publishable key is intended for browser use. **Never put your database password, `service_role` key, or any secret key in this file or in the website.** Row-level security policies in the SQL script protect database access.

## 4. Set authentication URLs

1. In Supabase, open **Authentication → URL Configuration**.
2. Set **Site URL** to the final website address, such as `https://YOUR_GITHUB_NAME.github.io/YOUR_REPOSITORY/`.
3. Add that same site address to the **Redirect URLs** allow list. If testing locally with a web server, also add its address, for example `http://localhost:5500/**`.
4. Keep email/password authentication enabled. If email confirmation is enabled, new users must confirm their email before signing in.

## 5. Publish the site and create your admin account

Supabase requests will not work reliably from a page opened as `file://`. Use a website URL instead.

1. Publish the project files, including `index.html`, `script.js`, `data.js`, `style.css`, `supabase-config.js`, and `supabase-setup.sql`, to your GitHub repository.
2. In GitHub, open the repository's **Settings → Pages**, choose the branch/folder containing the site, and enable Pages. Wait for GitHub to publish it.
3. Open the resulting `https://...github.io/.../` URL. Check that the Supabase setup warning is gone.
4. Select **Sign in / Register** and create your own account. Confirm the email if requested.
5. In Supabase **SQL Editor**, run the following query, replacing the email if your registered email is different:

   ```sql
   insert into public.admin_users (user_id)
   select id
   from auth.users
   where lower(email) = lower('manosuba040930@gmail.com')
   on conflict (user_id) do nothing;
   ```

6. Sign out and sign back in on the website, then select **Admin Portal**.

If the admin query completes but inserts no row, that email is not registered in this Supabase project yet. Register first, then run the query again. To verify the admin assignment:

```sql
select u.email, a.user_id
from auth.users as u
join public.admin_users as a on a.user_id = u.id
where lower(u.email) = lower('manosuba040930@gmail.com');
```

## 6. Check the workflow

- In **Admin Portal → Cars**, add or edit a car and confirm it appears in the showroom.
- Register a separate regular user, sign in, and submit car details with a JPEG, PNG, WebP, or GIF image no larger than 5 MB.
- As admin, open **Submissions** and approve or reject it. Only approved cars should appear in the public showroom.

Users can submit cars, but they cannot approve them or change their submission status. Supabase row-level security enforces this even if someone bypasses the website UI.

## Troubleshooting

- **SQL syntax error at `#` or at `supabase-setup.sql`:** You copied the guide or filename. Copy the contents of `supabase-setup.sql`; SQL begins with `create extension`.
- **Success, no rows returned:** This is expected for setup statements. Make sure the full script was selected and run; use the table verification query above.
- **Admin Portal says Supabase is not configured:** Check the URL/key in `supabase-config.js`, then reload the GitHub Pages site. Do not open `index.html` directly as a file.
- **Admin access is denied:** Verify the email exists under Supabase Authentication → Users, run the admin insert query with that exact email, then sign out and back in.
- **Database permission or missing-table errors:** Confirm the full `supabase-setup.sql` script completed without an error in the same Supabase project whose URL is in `supabase-config.js`.
