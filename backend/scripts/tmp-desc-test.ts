import 'dotenv/config';
import { extractInfo } from '../src/lib/cover';

const FAKE = `<!DOCTYPE html>
<html><head><title>Dom Casmurro - Amazon.com.br</title>
<meta name="description" content="Uma história de ciúme e desconfiança narrada por Bento Santiago. Este é um trecho da meta que a Amazon trunca com reticências quando a sinopse é mais longa que cento e sessenta caracteres, então o texto completo não vem...">
</head><body>
<img src="https://m.media-amazon.com/images/I/51cP8vXsMYL._SY346_.jpg" />
<span id="productTitle">Dom Casmurro</span>
<div id="bookDescription_feature_div" class="a-section a-spacing-small">
<div class="a-expander-content a-expander-partial-collapse-content a-expander-content-expanded">
<span>Texto completo da sinopse com várias frases: a história de ciúme de Bento Santiago é contada em capítulos curtos e irônicos, misturando memória, suspeita e literatura. Esta sinopse inteira deve aparecer no formulário, sem cortes, pois é o texto integral do produto publicado pela editora, incluindo detalhes sobre os personagens, o enredo e o contexto da obra de Machado de Assis.</span>
</div>
<div id="bookDescriptionExpanderCollapse" class="a-expander-collapsed"></div>
</div>
</body></html>`;

const info = extractInfo(FAKE);
console.log('descrição extraída:', JSON.stringify(info?.description));
console.log('completa?', info?.description?.includes('Machado de Assis') ? 'SIM' : 'NÃO');