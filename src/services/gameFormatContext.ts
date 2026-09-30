import { BlockType, GameFormat } from '../types/session';

// Tactical content only. Allocations, dimensions, schema and diagrams stay with their existing owners.
interface FormatContext {
  focus: string;
  technicalName: string;
  setup: string;
  warmUp: string;
  technical: string;
  skill: string;
  game: string;
  cue: string;
  progression: string;
}

const CONTEXT: Record<GameFormat, FormatContext> = {
  'Futsal 5v5': {
    focus: 'Hỗ trợ gần, bật tường nhanh và nhận bóng dưới áp lực tức thời trong không gian hẹp; chuyển trạng thái liên tục.',
    technicalName: 'Nhận bóng thoát áp lực gần và bật tường',
    setup: 'Giữ cự ly hỗ trợ gần, tạo góc chuyền chéo cạnh người nhận và một hướng thoát áp lực phía trước; đổi vị trí liên tục trong nhóm đã chia.',
    warmUp: 'Trong từng cặp, người chuyền dịch sang bên ngay sau đường chuyền. Người nhận kiểm tra vai, chạm bóng ra khỏi hướng áp sát giả định rồi trả bóng vào hướng di chuyển mới; đổi chân sau mỗi lượt.',
    technical: 'Trong mỗi nhóm nhỏ, bóng bắt đầu từ người hỗ trợ gần. Người nhận kiểm tra vai ngay trước khi bóng tới: nếu lưng bị khóa thì nhả một chạm và chạy nhận đường bật tường; nếu hướng trước trống thì chạm bóng thoát sang bên rồi chuyền tiến lên. Người vừa chuyền đi theo bóng đổi vai; người còn lại của nhóm làm điểm nối hoặc áp sát thụ động, luân phiên sau mỗi lượt.',
    skill: 'Trong hai đội đã chia, người gần bóng tạo quan hệ cục bộ 1v1, 2v1 hoặc 3v2 khi tình huống xuất hiện; đồng đội còn lại dịch chuyển làm hướng chuyền kế tiếp. Người nhận bị áp sát phải chọn bật tường hoặc xoay thoát theo hướng trống. Mất bóng thì người gần nhất áp sát ngay, đồng đội che đường chuyền gần; đoạt bóng thì tìm hướng tiến lên ngay.',
    game: 'Bàn thắng tính hai điểm khi trước đó có pha nhận bóng thoát áp lực gần bằng bật tường và chạy nhận lại. Khi đổi quyền kiểm soát, đội vừa đoạt bóng tìm đường chuyền tiến lên ngay; đội mất bóng thu hẹp các lựa chọn chuyền gần.',
    cue: 'Kiểm tra vai muộn trước khi bóng đến; bị khóa lưng thì nhả nhanh và chạy nhận lại, có khoảng trống mới xoay.',
    progression: 'Rút ngắn thời gian áp sát bằng cách cho người gây áp lực trong nhóm xuất phát sớm hơn; đổi vai sau mỗi lượt, không thêm cầu thủ.',
  },
  '7v7': {
    focus: 'Tam giác hỗ trợ gần, cầu thủ biên tạo chiều rộng và điểm tựa trung tâm nối các nhóm gần nhau trong hướng tấn công rõ ràng.',
    technicalName: 'Nhận nghiêng người nối tam giác biên – trung tâm',
    setup: 'Tạo góc tam giác giữa điểm tựa phía sau, vị trí nhận trung tâm và hướng chuyền ra biên; giữ các điểm hỗ trợ đủ gần để phối hợp tiến lên.',
    warmUp: 'Trong từng cặp, người nhận đứng lệch khỏi đường chuyền thẳng, nhìn bóng và hướng tiến lên cùng lúc. Nhận bằng chân xa rồi chuyền vào góc di chuyển mới của bạn; cả hai dịch chuyển theo hướng tấn công.',
    technical: 'Bóng bắt đầu ở điểm tựa phía sau của mỗi nhóm nhỏ. Người nhận trung tâm đứng nghiêng để nhìn cả người chuyền và hướng biên, nhận chân xa rồi nối bóng ra biên. Người chuyền ban đầu tiến lên tạo góc tam giác mới để nhận lại đường chuyền hướng trước; các thành viên đổi vai theo đường bóng, điểm nối còn lại luân phiên vào vị trí trung tâm.',
    skill: 'Trong hai đội đã chia, cầu thủ biên mở rộng vừa đủ, người trung tâm xuất hiện lệch khỏi người kèm và người phía sau luôn cho một đường trả bóng. Người nhận trung tâm chọn chuyền lên nếu hướng trước mở; nếu bị khóa thì chọn hướng biên còn trống, nhả về hoặc che bóng, rồi di chuyển tạo lại tam giác gần bóng.',
    game: 'Bàn thắng bình thường tính một điểm. Bàn thắng tính hai điểm nếu trong cùng lượt kiểm soát bóng, đội hoàn thành đường chuyền từ hành lang trung tâm ra hành lang biên, sau đó hoàn thành đường chuyền cho đồng đội đứng gần cầu môn đối phương hơn người chuyền. Dùng nón đánh dấu hành lang trung tâm và hai hành lang biên. Không chấm điểm theo tư thế thân người; người nhận được chọn xoay, nhả về, che bóng hoặc đổi hướng theo áp lực, không bắt buộc chuyền lên. Khi mất bóng, các cầu thủ gần nhau thu hẹp cự ly để bảo vệ hướng trung tâm.',
    cue: 'Kiểm tra hướng trước và hướng biên; có khoảng trống thì mở thân người chơi tiếp, bị khóa thì nhả lại hoặc che bóng.',
    progression: 'Người nhận chọn một trong hai hướng hỗ trợ theo góc người kèm; đổi hướng luân chuyển sau mỗi lượt, giữ cự ly gần.',
  },
  '9v9': {
    focus: 'Chiều rộng và chiều sâu rõ hơn, liên kết tiền vệ – tiền đạo, nhận giữa các tuyến với hỗ trợ sau và trước bóng; đổi cánh khi một bên bị khóa.',
    technicalName: 'Nhận giữa tuyến, nối chiều sâu hoặc đổi cánh',
    setup: 'Các vị trí trong nhóm đứng so le trước và sau bóng, có hướng mở ra biên. Trong đối kháng, giữ chiều rộng hai phía và chiều sâu giữa khu vực tiền vệ với người chơi cao hơn.',
    warmUp: 'Trong từng cặp, người nhận kiểm tra cả vai phía trước lẫn hướng biên, mở thân người nhận bóng rồi dẫn một nhịp theo chiều sâu trước khi trả bóng. Người chuyền lùi lệch làm điểm hỗ trợ phía sau; đổi vai liên tục.',
    technical: 'Trong mỗi nhóm nhỏ, bóng bắt đầu từ vị trí hỗ trợ phía sau. Người nhận di chuyển vào khoảng trống đại diện giữa tuyến tiền vệ và người chơi cao hơn, mở thân người nhìn trước bóng rồi chuyền vào hướng chiều sâu. Lượt kế tiếp, hướng trước bị khóa theo tín hiệu của bạn tập thì nhả về điểm tựa để chuyển bóng sang hướng biên đối diện. Luân phiên các vị trí sau mỗi đường chuyền, tập cả hai hướng.',
    skill: 'Trong hai đội đã chia, cầu thủ biên kéo rộng và người chơi cao hơn giữ chiều sâu để người nhận tìm khoảng trống giữa các tuyến. Người nhận kiểm tra hỗ trợ phía sau và phía trước: xoay nối với người chơi cao nếu có thời gian, hoặc nhả về cho đồng đội đổi cánh khi đối thủ dồn sang phía bóng.',
    game: 'Bàn thắng tính hai điểm khi pha tấn công có nhận bóng giữa các tuyến rồi chuyền thành công theo chiều sâu, hoặc nhả về và đổi cánh để thoát phía bị dồn ép. Đồng đội phải duy trì một lựa chọn sau bóng và một lựa chọn trước bóng.',
    cue: 'Quan sát vị trí tiền vệ, người chơi cao và cánh xa trước khi nhận; có chiều sâu thì xoay, bị khóa thì dùng điểm tựa sau bóng để đổi cánh.',
    progression: 'Đổi tín hiệu khóa hướng trước hoặc hướng biên để người nhận tự chọn chiều sâu hay đổi cánh; giữ các nhóm kỹ thuật nhỏ hoạt động đồng thời.',
  },
  '11v11': {
    focus: 'Liên kết hậu vệ – tiền vệ – tiền đạo, vai trò vị trí và nhận giữa tuyến tiền vệ với tuyến phòng ngự đối phương trong bối cảnh chiều rộng toàn đội; dùng các tuyến đại diện theo quân số hiện có.',
    technicalName: 'Nhận giữa hai tuyến và nối bóng qua người thứ ba',
    setup: 'Trong nhóm nhỏ, các vị trí luân phiên đại diện hậu vệ triển khai, tiền vệ nhận và người chơi phía trên. Trong đối kháng, trải vị trí theo chiều rộng và các tuyến đại diện, không bổ sung người cho đủ đội hình tiêu chuẩn.',
    warmUp: 'Trong từng cặp, người chuyền đóng vai vị trí triển khai, người nhận mở góc thân người về hướng tuyến kế tiếp được đánh dấu. Kiểm tra vai trước khi nhận, chạm chân xa qua hướng tuyến rồi trả bóng; đổi vai và hướng ngay lượt sau.',
    technical: 'Bóng bắt đầu ở vị trí đại diện hậu vệ của mỗi nhóm nhỏ. Tiền vệ di chuyển lệch khỏi bóng che của đối thủ giả định, nhận ở khoảng giữa tuyến tiền vệ và phòng ngự được đánh dấu. Nếu quay được thì nối bóng lên vị trí đại diện tiền đạo; nếu bị khóa lưng thì nhả cho điểm hỗ trợ để người thứ ba chuyền xuyên hướng tuyến. Các vai do chính thành viên nhóm luân phiên đảm nhiệm, đổi sau mỗi lượt, không ghép thành một nhóm lớn.',
    skill: 'Trong hai đội đã chia, phân vai tuyến dưới, tuyến giữa và người chơi cao bằng chính quân số hiện có. Bóng triển khai từ tuyến dưới; người nhận tìm khoảng trống giữa tuyến tiền vệ và phòng ngự đối phương, kiểm tra bóng che và áp lực sau lưng để xoay nối tuyến trên hoặc nhả cho người thứ ba. Các vị trí xa bóng giữ chiều rộng, người phía sau giữ điểm tựa khi đường xuyên tuyến bị chặn.',
    game: 'Bàn thắng tính hai điểm khi chuỗi triển khai nối được tuyến dưới qua người nhận giữa các tuyến tới tuyến trên, trực tiếp hoặc qua người thứ ba. Khi đối thủ pressing theo tuyến, đội có bóng dùng điểm tựa phía sau và chiều rộng để mở lại đường xuyên tuyến; duy trì đội hình đại diện theo quân số hiện có.',
    cue: 'Nhìn bóng che của tuyến tiền vệ và khoảng cách tới tuyến phòng ngự trước khi nhận; chọn xoay nối tuyến hoặc nhả cho người thứ ba.',
    progression: 'Cho tuyến phòng ngự hiện có chọn bước lên hoặc lùi để người nhận đọc khoảng trống giữa tuyến; giai đoạn kỹ thuật chỉ dùng tín hiệu và đổi vai nhanh trong nhóm nhỏ.',
  },
};

export function gameFormatTacticalGuidance(format: GameFormat): string {
  const context = CONTEXT[format];
  return `${context.focus}\nKỹ thuật: ${context.technical}\nKỹ năng: ${context.skill}\nĐiều kiện trò chơi: ${context.game}\nÁp dụng các quan hệ này vào chủ đề đang tập, không đổi chủ đề. Phải khác về lựa chọn xử lý, di chuyển hỗ trợ và điều kiện ghi điểm, không chỉ khác tên hay kích thước. Các quan hệ cục bộ là tình huống trong quân số đã chia, không phải cầu thủ bổ sung. Kỹ thuật luôn tập song song theo nhóm nhỏ, đổi vai nhanh.`;
}

export function formatPhaseContent(format: GameFormat, block: BlockType, topic: string, base: {
  exerciseName: string; execution: string; coachingPoints: string[]; progression?: string;
}) {
  const context = CONTEXT[format];
  const receiving = /nhận bóng|mở thân|quan sát/i.test(topic);
  const behavior = block === 'warm_up' ? context.warmUp : block === 'technical' ? context.technical :
    block === 'skill' ? context.skill : context.game;
  return {
    exerciseName: !receiving || block === 'match' ? base.exerciseName : `${topic}: ${block === 'technical' ? context.technicalName :
      block === 'warm_up' ? 'Kích hoạt – ' + context.technicalName :
        block === 'skill' ? 'Đối kháng – ' + context.technicalName : 'Trò chơi – ' + context.technicalName}`,
    execution: receiving ? behavior : `${base.execution}\nBối cảnh ${format}: ${context.focus} Vận dụng ${topic} trong các quan hệ hỗ trợ này.`,
    coachingPoints: receiving ? [context.cue,
      block === 'warm_up' || block === 'technical' ? 'Đổi vai theo đường bóng, tập cả hai chân và bắt đầu lượt kế tiếp ngay, không xếp hàng dài.' : context.focus,
      'Chỉ xoay người khi nhìn thấy hướng chơi tiếp; bị khóa thì dùng đồng đội hỗ trợ.'] : [...base.coachingPoints, context.focus],
    progression: receiving ? (block === 'warm_up' ? 'Đổi hướng tiếp cận và chân nhận sau mỗi lượt, giữ áp lực thấp.' : context.progression) : base.progression,
    spatialSetup: block === 'warm_up' ? 'Các cặp hoạt động đồng thời, nhận bóng ở góc lệch và đổi vị trí theo đường bóng; giữ áp lực thấp.' : context.setup,
  };
}
