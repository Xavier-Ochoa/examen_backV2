import { Schema, model } from 'mongoose';
import bcrypt from 'bcryptjs';

// Definimos el esquema para el modelo de Estudiante
const estudianteSchema = new Schema(
  {
    nombre: {
      type: String,
      required: true,
      trim: true,
    },
    apellido: {
      type: String,
      required: true,
      trim: true,
    },
    cedula: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    celular: {
      type: String,
      trim: true,
      default: null,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      unique: true,
      lowercase: true,
    },
    password: {
      type: String,
      required: true,
    },
    // Información académica
    carrera: {
      type: String,
      required: true      
    },
    nivel: {
      type: Number,
      required: true,
      min: [1, 'El nivel debe ser al menos 1'],
      max: [6, 'El nivel no puede ser mayor a 6'],
    },
    status: {
      type: Boolean,
      default: true,
    },
    token: {
      type: String,
      default: null,
    },
    confirmEmail: {
      type: Boolean,
      default: false,
    },
    rol: {
      type: String,
      enum: ['estudiante', 'admin'],
      default: 'estudiante',
    },
    // Información adicional
    bio: {
      type: String,
      maxlength: 500,
      trim: true,
    },
    fotoPerfil: {
      url: String,
      publicId: String,
    },
    
    // ===== NUEVOS CAMPOS PARA OAUTH =====
    
    // Google OAuth
    googleId: {
      type: String,
      sparse: true, // Permite null y unique al mismo tiempo
      unique: true,
    },
    
    // Facebook OAuth
    facebookId: {
      type: String,
      sparse: true,
      unique: true,
    },
    
    // Provider de autenticación
    authProvider: {
      type: String,
      enum: ['local', 'google', 'facebook'],
      default: 'local',
    },
    
    // Última vez que el usuario inició sesión
    lastLogin: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Método para cifrar el password
estudianteSchema.methods.encryptPassword = async function (password) {
  const salt = await bcrypt.genSalt(10);
  const passwordEncryp = await bcrypt.hash(password, salt);
  return passwordEncryp;
};

// Método para verificar si el password es el mismo de la BDD
estudianteSchema.methods.matchPassword = async function (password) {
  const response = await bcrypt.compare(password, this.password);
  return response;
};

// Método para crear un token
estudianteSchema.methods.createToken = function () {
  const tokenGenerado = Math.random().toString(36).slice(2);
  this.token = tokenGenerado;
  return tokenGenerado;
};

// Método para actualizar último login
estudianteSchema.methods.updateLastLogin = async function () {
  this.lastLogin = new Date();
  return await this.save();
};

// Exportamos el modelo con el nombre 'Estudiante'
export default model('Estudiante', estudianteSchema);
