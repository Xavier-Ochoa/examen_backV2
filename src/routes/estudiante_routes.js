import { Router } from 'express';
import {
  listarEstudiantes,
  obtenerEstudiante,
  estadisticasEstudiantes
} from '../controllers/estudiante_controller.js';
import { verificarTokenJWT, verificarAdmin } from '../middlewares/JWT.js';

const router = Router();

/**
 * IMPORTANTE: Todas estas rutas requieren:
 * 1. Token JWT válido (verificarTokenJWT)
 * 2. Rol de administrador (verificarAdmin)
 */

// ===== RUTAS DE ADMINISTRADOR =====

/**
 * GET /api/admin/estudiantes
 * Listar todos los estudiantes con filtros opcionales
 * 
 * Query params opcionales:
 * - carrera: String - Filtrar por carrera exacta
 * - nivel: Number (1-6) - Filtrar por nivel
 * - apellido: String - Buscar por apellido (parcial o exacto)
 * 
 * Ejemplos:
 * - /api/admin/estudiantes
 * - /api/admin/estudiantes?carrera=Ingeniería en Software
 * - /api/admin/estudiantes?nivel=5
 * - /api/admin/estudiantes?apellido=Pérez
 * - /api/admin/estudiantes?apellido=Per (búsqueda parcial)
 * - /api/admin/estudiantes?carrera=Ingeniería en Software&nivel=5
 */
router.get(
  '/',
  verificarTokenJWT,
  verificarAdmin,
  listarEstudiantes
);

/**
 * GET /api/admin/estudiantes/estadisticas
 * Obtener estadísticas de estudiantes
 * - Total de estudiantes
 * - Estudiantes por carrera
 * - Estudiantes por nivel
 */
router.get(
  '/estadisticas',
  verificarTokenJWT,
  verificarAdmin,
  estadisticasEstudiantes
);

/**
 * GET /api/admin/estudiantes/:id
 * Obtener un estudiante específico por ID
 * Devuelve información completa (menos password y token)
 */
router.get(
  '/:id',
  verificarTokenJWT,
  verificarAdmin,
  obtenerEstudiante
);

export default router;