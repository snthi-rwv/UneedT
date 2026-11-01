import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class RegisterDto {
    @IsEmail({}, { message: 'Escribe un correo válido' }) email: string;
    @IsString() @MinLength(2) @MaxLength(80) name: string;
    @IsString() @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres' }) @MaxLength(100) password: string;
}

export class LoginDto {
    @IsEmail() email: string;
    @IsString() @MaxLength(100) password: string;
}

export class RefreshDto {
    @IsString() @MaxLength(2000) refreshToken: string;
}