import dotenv from 'dotenv';
dotenv.config(); // 🔥 OBLIGATORIO aquí

import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';

import Estudiante from '../models/Estudiante.js';

/**
 * Configuración de Passport.js para autenticación con Google
 * VERSIÓN SOLO BACKEND - Sin frontend
 * Sistema de Proyectos ESFOT - EPN
 */

// ===== GOOGLE OAUTH STRATEGY =====
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL,
      proxy: true,
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        console.log('📧 Google Profile:', profile.emails[0].value);

        // Buscar si el usuario ya existe por googleId
        let estudiante = await Estudiante.findOne({ googleId: profile.id });

        if (estudiante) {
          // Usuario ya existe, retornarlo
          console.log('✅ Usuario existente encontrado');
          return done(null, estudiante);
        }

        // Buscar si existe un usuario con el mismo email
        estudiante = await Estudiante.findOne({
          email: profile.emails[0].value,
        });

        if (estudiante) {
          // Usuario existe pero sin googleId, actualizar
          console.log('🔄 Actualizando usuario existente con Google ID');
          estudiante.googleId = profile.id;
          estudiante.fotoPerfil = {
            url: profile.photos[0]?.value || null,
          };
          estudiante.confirmEmail = true; // Google ya verificó el email
          await estudiante.save();
          return done(null, estudiante);
        }

        // Crear nuevo usuario
        console.log('🆕 Creando nuevo usuario desde Google');
        const nuevoEstudiante = new Estudiante({
          googleId: profile.id,
          nombre: profile.name.givenName,
          apellido: profile.name.familyName,
          email: profile.emails[0].value,
          fotoPerfil: {
            url: profile.photos[0]?.value || null,
          },
          confirmEmail: true, // Google ya verificó el email
          authProvider: 'google',
          // Campos requeridos con valores por defecto temporal
          cedula: `GOOGLE-${profile.id.substring(0, 10)}`, // Temporal
          carrera: 'Desarrollo de Software', // Por defecto
          nivel: 1, // Por defecto
          password: Math.random().toString(36).slice(-10), // Password aleatorio (no se usará)
        });

        await nuevoEstudiante.save();
        console.log('✅ Nuevo usuario creado exitosamente');
        done(null, nuevoEstudiante);
      } catch (error) {
        console.error('❌ Error en Google Strategy:', error);
        done(error, null);
      }
    }
  )
);

// ===== SERIALIZACIÓN Y DESERIALIZACIÓN =====
// (Necesario para mantener la sesión)

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await Estudiante.findById(id);
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

export default passport;
