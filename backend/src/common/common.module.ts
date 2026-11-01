import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { CryptoService } from './services/crypto.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

// Piezas transversales disponibles en toda la app.
@Global()
@Module({
    imports: [JwtModule.register({})],
    providers: [CryptoService, JwtAuthGuard],
    exports: [JwtModule, CryptoService, JwtAuthGuard],
})
export class CommonModule {}