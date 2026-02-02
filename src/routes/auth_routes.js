import { Router } from 'express';
import passport from 'passport';
import { 
  comprobarTokenPasword, 
  confirmarMail, 
  crearNuevoPassword, 
  recuperarPassword, 
  registro, 
  login, 
  perfil, 
  actualizarPerfil, 
  actualizarPassword,
  getUnsplashImage,
  fetchQuoteController
} from '../controllers/auth_controller.js';
import { verificarTokenJWT, crearTokenJWT } from '../middlewares/JWT.js';

// ⭐ IMPORTAR VALIDACIONES
import { validarRegistro } from '../validators/auth_validators.js';
import { manejarErroresValidacion } from '../middlewares/validaciones.js';

const router = Router();

// ===== RUTAS PÚBLICAS - AUTENTICACIÓN TRADICIONAL =====

// Registro CON VALIDACIÓN
router.post(
  '/registro',
  validarRegistro,
  manejarErroresValidacion,
  registro
);
router.post('/login', login);
router.get('/confirm/:token', confirmarMail);
router.post('/recuperarpassword', recuperarPassword);
router.get('/recuperarpassword/:token', comprobarTokenPasword);
router.post('/nuevopassword/:token', crearNuevoPassword);

// Servicios adicionales
router.get('/random-image', getUnsplashImage);
router.get('/frases', fetchQuoteController);

// ===== RUTAS OAUTH GOOGLE =====

/**
 * GET /api/auth/google
 * Inicia el flujo de autenticación con Google
 * 
 * Para probar: Abre http://localhost:3000/api/auth/google en el navegador
 */
router.get(
  '/google',
  passport.authenticate('google', {
    scope: ['profile', 'email'],
  })
);

/**
 * GET /api/auth/google/callback
 * Callback de Google - Devuelve JSON con el token
 */
router.get(
  '/google/callback',
  passport.authenticate('google', { 
    failureRedirect: '/api/auth/google/failure',
    session: false, // No usar sesiones, solo JWT
  }),
  async (req, res) => {
    try {
      // Actualizar último login
      await req.user.updateLastLogin();
      
      // Crear JWT
      const token = crearTokenJWT(req.user._id, req.user.rol);
      
      // Preparar datos del usuario (sin campos sensibles)
      const { password, token: userToken, __v, ...userData } = req.user.toObject();
      
      // ===== RESPUESTA JSON =====
      res.status(200).json({
        success: true,
        message: 'Autenticación con Google exitosa',
        token: token,
        user: {
          _id: userData._id,
          nombre: userData.nombre,
          apellido: userData.apellido,
          email: userData.email,
          carrera: userData.carrera,
          nivel: userData.nivel,
          cedula: userData.cedula,
          fotoPerfil: userData.fotoPerfil,
          rol: userData.rol,
          authProvider: 'google',
          googleId: userData.googleId,
          confirmEmail: userData.confirmEmail,
          lastLogin: userData.lastLogin,
        },
      });
    } catch (error) {
      console.error('Error en callback de Google:', error);
      res.status(500).json({
        success: false,
        message: 'Error en el proceso de autenticación',
        error: error.message,
      });
    }
  }
);

/**
 * GET /api/auth/google/failure
 * Manejo de errores de Google OAuth
 */
router.get('/google/failure', (req, res) => {
  res.status(401).json({
    success: false,
    message: 'Autenticación con Google fallida',
    error: 'El usuario canceló la autenticación o hubo un error',
  });
});

// ===== RUTAS OAUTH FACEBOOK =====

/**
 * GET /api/auth/facebook
 * Inicia el flujo de autenticación con Facebook
 * 
 * Para probar: Abre http://localhost:3000/api/auth/facebook en el navegador
 */
router.get(
  '/facebook',
  passport.authenticate('facebook', {
    scope: ['email', 'public_profile'],
  })
);

/**
 * GET /api/auth/facebook/callback
 * Callback de Facebook - Devuelve JSON con el token
 */
router.get(
  '/facebook/callback',
  passport.authenticate('facebook', { 
    failureRedirect: '/api/auth/facebook/failure',
    session: false,
  }),
  async (req, res) => {
    try {
      // Actualizar último login
      await req.user.updateLastLogin();
      
      // Crear JWT
      const token = crearTokenJWT(req.user._id, req.user.rol);
      
      // Preparar datos del usuario
      const { password, token: userToken, __v, ...userData } = req.user.toObject();
      
      // ===== RESPUESTA JSON =====
      res.status(200).json({
        success: true,
        message: 'Autenticación con Facebook exitosa',
        token: token,
        user: {
          _id: userData._id,
          nombre: userData.nombre,
          apellido: userData.apellido,
          email: userData.email,
          carrera: userData.carrera,
          nivel: userData.nivel,
          cedula: userData.cedula,
          fotoPerfil: userData.fotoPerfil,
          rol: userData.rol,
          authProvider: 'facebook',
          facebookId: userData.facebookId,
          confirmEmail: userData.confirmEmail,
          lastLogin: userData.lastLogin,
        },
      });
    } catch (error) {
      console.error('Error en callback de Facebook:', error);
      res.status(500).json({
        success: false,
        message: 'Error en el proceso de autenticación',
        error: error.message,
      });
    }
  }
);

/**
 * GET /api/auth/facebook/failure
 * Manejo de errores de Facebook OAuth
 */
router.get('/facebook/failure', (req, res) => {
  res.status(401).json({
    success: false,
    message: 'Autenticación con Facebook fallida',
    error: 'El usuario canceló la autenticación o hubo un error',
  });
});

// ===== RUTAS PROTEGIDAS =====

router.get('/perfil', verificarTokenJWT, perfil);
router.put('/perfil/:id', verificarTokenJWT, actualizarPerfil);
router.put('/password/:id', verificarTokenJWT, actualizarPassword);

export default router;