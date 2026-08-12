if (last && Date.now() - last > INACTIVITY_LIMIT_MS) {
      await supabase.auth.signOut();
      const redirect = NextResponse.redirect(
        new URL("/login?expirado=1", request.url)
      );
      // signOut() grava a limpeza dos cookies de sessão em `response`,
      // que seria descartado ao retornar `redirect`. Copiamos aqui.
      response.cookies.getAll().forEach((cookie) => {
        redirect.cookies.set(cookie);
      });
      redirect.cookies.delete(LAST_ACTIVITY_COOKIE);
      return redirect;
    }
